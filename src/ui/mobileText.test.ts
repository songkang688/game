import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MIN_BODY_PX,
  MIN_CONTROL_PX,
  MIN_LINE_HEIGHT,
  MIN_SAFE_BOTTOM_PX,
  MIN_TITLE_PX_AT_360,
  MOBILE_CSS_MARKERS,
  NARROW_BREAKPOINT,
  WRAP_RULES,
  applyMobileTextVars,
  clampBodyPx,
  clampControlPx,
  clampLineHeight,
  isNarrow,
  safeBottom,
  titleClamp
} from "./mobileText";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("手机文字硬指标", () => {
  it("正文字号下限是 16px,控件是 14px", () => {
    expect(MIN_BODY_PX).toBe(16);
    expect(MIN_CONTROL_PX).toBe(14);
    expect(MIN_CONTROL_PX).toBeLessThan(MIN_BODY_PX);
  });

  it("360px 时标题不小于 20px,行高不小于 1.4", () => {
    expect(MIN_TITLE_PX_AT_360).toBe(20);
    expect(MIN_LINE_HEIGHT).toBe(1.4);
  });

  it("验收视口就是 360px", () => {
    expect(NARROW_BREAKPOINT).toBe(360);
  });

  it("正文字号夹取:小的抬上来,大的原样留着", () => {
    expect(clampBodyPx(12)).toBe(16);
    expect(clampBodyPx(16)).toBe(16);
    expect(clampBodyPx(21)).toBe(21);
  });

  it("控件字号夹取同理", () => {
    expect(clampControlPx(10)).toBe(14);
    expect(clampControlPx(18)).toBe(18);
  });

  it("行高夹取", () => {
    expect(clampLineHeight(1)).toBe(1.4);
    expect(clampLineHeight(1.8)).toBe(1.8);
  });

  it("脏值不会算出 NaN", () => {
    expect(clampBodyPx(Number.NaN)).toBe(16);
    expect(clampControlPx(Number.POSITIVE_INFINITY)).toBe(14);
    expect(clampLineHeight(Number.NaN)).toBe(1.4);
  });

  it("标题 clamp() 串的下限永远不低于 20px", () => {
    expect(titleClamp()).toBe("clamp(20px, 5.4vw, 30px)");
    expect(titleClamp(14)).toContain("clamp(20px");
    expect(titleClamp(24, 40)).toBe("clamp(24px, 5.4vw, 40px)");
  });

  it("标题 clamp() 的上限不会被写反", () => {
    expect(titleClamp(28, 20)).toBe("clamp(28px, 5.4vw, 28px)");
  });

  it("底部安全区至少 12px,并交给 env() 兜底", () => {
    expect(MIN_SAFE_BOTTOM_PX).toBe(12);
    expect(safeBottom()).toBe("max(12px, env(safe-area-inset-bottom))");
    expect(safeBottom(20)).toBe("max(20px, env(safe-area-inset-bottom))");
  });

  it("窄屏判定:360 及以下算窄,宽屏与脏值不算", () => {
    expect(isNarrow(320)).toBe(true);
    expect(isNarrow(360)).toBe(true);
    expect(isNarrow(361)).toBe(false);
    expect(isNarrow(0)).toBe(false);
    expect(isNarrow(Number.NaN)).toBe(false);
  });

  it("换行规则不许用 nowrap 把汉字挤成竖条", () => {
    expect(WRAP_RULES).toContain("overflow-wrap: anywhere");
    expect(WRAP_RULES).toContain("word-break: break-word");
    expect(WRAP_RULES.join("")).not.toContain("nowrap");
  });

  it("applyMobileTextVars 把约定写成 CSS 变量,传空也不炸", () => {
    const written = new Map<string, string>();
    applyMobileTextVars({ style: { setProperty: (k, v) => void written.set(k, v) } });
    expect(written.get("--mt-body")).toBe("16px");
    expect(written.get("--mt-line")).toBe("1.4");
    expect(written.get("--mt-title")).toBe(titleClamp());
    expect(written.get("--mt-safe-bottom")).toBe(safeBottom());
    expect(() => applyMobileTextVars(null)).not.toThrow();
  });
});

describe("styles.css 巡检", () => {
  it("1.2 的手机文字区块在", () => {
    for (const marker of MOBILE_CSS_MARKERS) {
      expect(CSS, `styles.css 里缺少 ${marker}`).toContain(marker);
    }
  });

  it("底部安全区用了 env(safe-area-inset-bottom)", () => {
    expect(CSS).toContain("env(safe-area-inset-bottom)");
  });

  it("长文案能断行", () => {
    expect(CSS).toContain("overflow-wrap: anywhere");
    expect(CSS).toContain("word-break: break-word");
  });

  it("有 360px 的媒体查询分支", () => {
    expect(CSS).toMatch(/@media\s*\(max-width:\s*360px\)/);
  });

  it("游戏名没有被 nowrap 挤住", () => {
    expect(CSS).not.toMatch(/\.card-title\s*\{[^}]*white-space:\s*nowrap/);
    // 小卡上的名字宽屏用省略号,窄屏必须放开成两行
    const narrow = CSS.slice(CSS.search(/@media\s*\(max-width:\s*360px\)/));
    expect(narrow).toMatch(/\.recent-name\s*\{[^}]*white-space:\s*normal/);
  });

  it("无障碍相关的老规则一条都没被删", () => {
    expect(CSS).toContain(".sr-only");
    expect(CSS).toContain(":focus-visible");
    expect(CSS).toContain("prefers-reduced-motion");
  });

  it("index.html 的 viewport 覆盖了刘海屏", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).toContain("viewport-fit=cover");
  });
});

// ---------------------------------------------------------------------------
// 1.2 窗口 1 · 第 1 轮验收:360×640 真机走查回落下来的几处
//
// 上面那些用例查的是「约定写没写」,这一节查的是「约定有没有被具体的选择器违反」——
// 都是拿 360×640 的真浏览器量出来、再钉回源码的,以后谁把字号调小就会红。
// ---------------------------------------------------------------------------

const HOME_TS = readFileSync(new URL("./home.ts", import.meta.url), "utf8");
const L99_TS = readFileSync(new URL("../games/level99.ts", import.meta.url), "utf8");
const SNAKE_TS = readFileSync(new URL("../games/snake-royale/index.ts", import.meta.url), "utf8");

/**
 * 从一段 CSS 源码里取某个选择器最终生效的 font-size(px);一条都没写返回 null。
 * 同名选择器写了好几遍时按层叠取**最后一条**;`max(var(--mt-body), 16px)`
 * 这种夹取写法取里面最大的那个 px 字面量。
 */
function fontSizeOf(css: string, selector: string): number | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocks = [...css.matchAll(new RegExp(`(?:^|[,}\\s])${escaped}\\s*\\{([^}]*)\\}`, "g"))];
  let last: number | null = null;
  for (const b of blocks) {
    const decl = b[1].match(/font-size:\s*([^;]+)/);
    if (!decl) continue;
    const pxs = [...decl[1].matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    if (pxs.length > 0) last = Math.max(...pxs);
  }
  return last;
}

describe("360×640 走查回落:说明文字不许小过正文下限", () => {
  // 选关地图上这几行都是「讲给孩子听的话」,不是按钮也不是格子里的数字,
  // 按 MIN_BODY_PX 走。它们是 188 关框架的公共皮肤,12 款新游戏全都吃这一份。
  const L99_BODY_CLASSES = [
    ".l99-chip", // 🚩 0/188 关 / ⭐ 0/564
    ".l99-chapdesc", // 章节说明
    ".l99-pagehint", // 第 X / Y 章 · 第 A–B 关
    ".l99-flash", // 一次性提示条
    ".l99-jump-note", // 管理员权限还剩 XX 分钟
    ".l99-maphint" // 地图底部的玩法小贴士
  ];

  for (const cls of L99_BODY_CLASSES) {
    it(`level99 的 ${cls} 不小于 ${MIN_BODY_PX}px`, () => {
      const px = fontSizeOf(L99_TS, cls);
      expect(px, `${cls} 在 level99.ts 里找不到`).not.toBeNull();
      expect(px, `${cls} 是说明文字,360px 上不能小过 ${MIN_BODY_PX}px`).toBeGreaterThanOrEqual(
        MIN_BODY_PX
      );
    });
  }

  it("首页页脚与结果计数是说明文字,不小于 16px", () => {
    expect(fontSizeOf(CSS, ".home-footer")).toBeGreaterThanOrEqual(MIN_BODY_PX);
    expect(fontSizeOf(HOME_TS, ".home-count")).toBeGreaterThanOrEqual(MIN_BODY_PX);
  });

  it("长蛇争霸的皮肤按钮是控件,不小于 14px", () => {
    expect(fontSizeOf(SNAKE_TS, ".sr-skin")).toBeGreaterThanOrEqual(MIN_CONTROL_PX);
  });

  // 12 款各有一行「刚才发生了什么」的状态文字(`.xx-msg`),外加几款的补充说明
  // (`.xx-note`)。这是孩子玩的时候盯得最多的一行,而 8 款还在 360px 的媒体查询里
  // 把它**再调小到 13px** —— 360×640 正是验收视口,越窄越小是反的。
  const GAME_BODY_CLASSES: [string, string[]][] = [
    ["orb-arena", [".oa-msg"]],
    ["snake-royale", [".sr-msg"]],
    ["block-drop", [".bd-msg"]],
    ["combo-clash", [".cc-msg", ".cc-note"]],
    ["mahjong-bloom", [".mj-msg"]],
    ["star-estate", [".se-msg"]],
    ["hero-cards", [".hc-msg"]],
    ["weiqi-garden", [".wq-msg", ".wq-note"]],
    ["flight-chess", [".fc-msg"]],
    ["merge-2048", [".mg-msg"]],
    ["mine-garden", [".mn-msg", ".mn-note"]],
    ["sudoku-petal", [".sp-msg"]]
  ];

  for (const [id, classes] of GAME_BODY_CLASSES) {
    it(`${id} 的状态文字在窄屏也不小过 ${MIN_BODY_PX}px`, () => {
      const src = readFileSync(new URL(`../games/${id}/index.ts`, import.meta.url), "utf8");
      for (const cls of classes) {
        // fontSizeOf 取的是层叠后**最后一条**,窄屏媒体查询写在后面,
        // 所以这一条同时管住了基准值和 360px 分支
        const px = fontSizeOf(src, cls);
        expect(px, `${id} 里找不到 ${cls}`).not.toBeNull();
        expect(px, `${id} 的 ${cls} 是状态文字,360px 上不能小过 ${MIN_BODY_PX}px`).toBeGreaterThanOrEqual(
          MIN_BODY_PX
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 1.2 窗口 1 · 第 2 轮:二级界面(对战 / 无尽 / 双人同屏 + 结算面板)
//
// 第 1 轮的字号取证只覆盖到每款的**入口屏**那一行 `.xx-msg`。真正让人眯眼的是
// 进了模式之后那些一直在变的读数:HUD 徽章、排行榜、席位行、战报、目标行,
// 以及每一局打完弹出来的结算副标题。它们全是「讲给孩子听的话」,按正文下限走。
// 好几款还在 `@media (max-width:360px)` 里把这些字**再调小一档** —— 360×640 正是
// 验收视口,越窄越小是反的,那些覆盖一律删掉(不是抬一点,是删掉)。
// ---------------------------------------------------------------------------

describe("360×640 走查回落:二级界面的状态行与结算副标题", () => {
  /** 每款在对战 / 无尽 / 双人同屏里会变的读数,以及结算面板的副标题 */
  const SECONDARY_BODY_CLASSES: [string, string[]][] = [
    ["orb-arena", [".oa-badge", ".oa-board", ".oa-board summary", ".oa-over-s"]],
    ["snake-royale", [".sr-badge", ".sr-board", ".sr-board summary", ".sr-over-s"]],
    ["block-drop", [".bd-badge", ".bd-mini", ".bd-over-s"]],
    ["combo-clash", [".cc-badge", ".cc-name", ".cc-combo", ".cc-info", ".cc-over-s"]],
    ["mahjong-bloom", [".mj-badge", ".mj-goal", ".mj-sheet-s", ".mj-foe-name"]],
    // 下面这几个是第 2 轮真浏览器进了模式之后才量到的:抽屉标题、地契卡、
    // 席位难度、当前格预览、战报、牌堆、规则条、连清计数 —— 全是玩着玩着一直在看的读数
    [
      "star-estate",
      [".se-badge", ".se-seat", ".se-over-s", ".se-seat-tier", ".se-preview", ".se-log", ".se-drawer-h", ".se-deed"]
    ],
    ["hero-cards", [".hc-badge", ".hc-seat", ".hc-log", ".hc-over-s", ".hc-pile"]],
    ["weiqi-garden", [".wq-chip", ".wq-label", ".wq-over-s", ".wq-rows"]],
    ["flight-chess", [".fc-badge", ".fc-seat", ".fc-seat-tier", ".fc-goal", ".fc-keys", ".fc-over-s"]],
    ["merge-2048", [".mg-badge", ".mg-over-s"]],
    ["mine-garden", [".mn-chip", ".mn-over-s", ".mn-side"]],
    ["sudoku-petal", [".sp-badge", ".sp-name", ".sp-hintbox", ".sp-pause"]]
  ];

  for (const [id, classes] of SECONDARY_BODY_CLASSES) {
    it(`${id} 的二级界面读数在窄屏也不小过 ${MIN_BODY_PX}px`, () => {
      const src = readFileSync(new URL(`../games/${id}/index.ts`, import.meta.url), "utf8");
      for (const cls of classes) {
        const px = fontSizeOf(src, cls);
        expect(px, `${id} 里找不到 ${cls}`).not.toBeNull();
        expect(px, `${id} 的 ${cls} 是二级界面的说明文字,360px 上不能小过 ${MIN_BODY_PX}px`).toBeGreaterThanOrEqual(
          MIN_BODY_PX
        );
      }
    });
  }

  it("窄屏媒体查询里不许再把这些读数调小(要么不写,要么写得更大)", () => {
    const bad: string[] = [];
    for (const [id, classes] of SECONDARY_BODY_CLASSES) {
      const src = readFileSync(new URL(`../games/${id}/index.ts`, import.meta.url), "utf8");
      // 各款的窄屏断点不完全一致(360 / 380 / 420),从第一个 max-width 段起往后都算
      const at = src.search(/@media\s*\(max-width:\s*\d+px\)/);
      if (at < 0) continue;
      const narrow = src.slice(at);
      for (const cls of classes) {
        const px = fontSizeOf(narrow, cls);
        if (px !== null && px < MIN_BODY_PX) bad.push(`${id} 的 ${cls} 在窄屏被调到 ${px}px`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("按钮文字窄屏也不小过控件下限 14px", () => {
    const CONTROLS: [string, string[]][] = [
      ["orb-arena", [".oa-btn"]],
      ["snake-royale", [".sr-btn", ".sr-skin"]],
      ["block-drop", [".bd-btn"]],
      ["combo-clash", [".cc-btn", ".cc-open"]],
      ["mahjong-bloom", [".mj-btn"]],
      ["star-estate", [".se-btn", ".se-deed"]],
      ["hero-cards", [".hc-btn"]],
      ["weiqi-garden", [".wq-btn", ".wq-open"]],
      ["flight-chess", [".fc-btn"]],
      ["mine-garden", [".mn-btn"]],
      ["sudoku-petal", [".sp-tool"]]
    ];
    const bad: string[] = [];
    for (const [id, classes] of CONTROLS) {
      const src = readFileSync(new URL(`../games/${id}/index.ts`, import.meta.url), "utf8");
      for (const cls of classes) {
        const px = fontSizeOf(src, cls);
        if (px === null) bad.push(`${id} 里找不到 ${cls}`);
        else if (px < MIN_CONTROL_PX) bad.push(`${id} 的 ${cls} 只有 ${px}px`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("360×640 走查回落:首页搜索框不许顶出屏幕", () => {
  // 实测:360px 视口下 .home-search 被自动最小尺寸撑到 370px,
  // 「清空搜索」的 ✕ 右边缘落在 375px,被屏幕裁掉一半点不着。
  // flex item 的 min-width 缺省是 auto,必须显式夹成 0 才会跟着容器缩。
  it(".home-search 写了 min-width:0", () => {
    const block = HOME_TS.match(/\.home-search\s*\{([^}]*)\}/);
    expect(block, "home.ts 里找不到 .home-search 规则").not.toBeNull();
    expect(block?.[1], ".home-search 是 flex item,不夹 min-width:0 会顶出 360px 屏幕").toMatch(
      /min-width:\s*0/
    );
  });

  it("清空按钮不靠负 margin 挤出容器", () => {
    const block = HOME_TS.match(/\.home-search-clear\s*\{([^}]*)\}/);
    expect(block?.[1]).not.toMatch(/margin-right:\s*-/);
  });
});

describe("首页文案里的游戏款数是数出来的,不是写死的", () => {
  // 1.1 是 55 款,窗口 1 加完 12 款就已经是 67 款,写死的数字必然过时。
  it("hero 气泡不写死款数", () => {
    const bubble = HOME_TS.match(/heroBubble\.innerHTML\s*=\s*`([^`]*)`/);
    expect(bubble, "找不到 hero 气泡文案").not.toBeNull();
    expect(bubble?.[1], "款数要从 games.length 数出来").not.toMatch(/\d+\s*款/);
  });
});
