/**
 * N-33(trio-r9):壳层结算弹窗矮横屏「再玩一次 / 回首页」折叠在弹窗内滚线下。
 *
 * 真机实测(Chrome 无头,duo-rush 抢金币赛真实结算触发):
 * 修前 915×412 弹窗 16–396、内滚 109,「🔁 再玩一次」bottom=429 切半、「🏠 回首页」top=441 整颗在可视底之外;
 * 844×390 两颗都够不着;320×568 主钮切半。390×844 / 412×915 / 1024×768 / 1280×800 / 360×640 修前就干净。
 * 修后 915×412 内滚 109→6、两颗钮 278–376 全在弹窗可视区内;干净的五档按钮坐标逐像素不变。
 *
 * 配方 I:滚动边界切在「读的(星级/文案)」与「按的(按钮列)」之间。
 * 这里钉住 CSS 侧的三件事 + `dialogs.ts` 语义未被顺手改动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLICK_GUARD_MS, isGuardedClick } from "./dialogs";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const DIALOGS_TS = readFileSync(new URL("./dialogs.ts", import.meta.url), "utf8");

/**
 * 取出「选择器单开一条」的规则声明块(顶层、不缩进)。
 * `.dialog-buttons` 与 `.dialog-buttons::after` 还各自出现在合写的选择器组里
 * (`.card-meta, .dialog-buttons {…}` / `.dialog-buttons::before, .dialog-buttons::after {…}`),
 * 靠「前一个非空白字符不是逗号」把组里的那次排掉。
 */
function ruleBlock(selector: string): string {
  const needle = `\n${selector} {`;
  for (let at = CSS.indexOf(needle); at >= 0; at = CSS.indexOf(needle, at + 1)) {
    const prev = CSS.slice(0, at).trimEnd().slice(-1);
    if (prev === ",") continue;
    const open = CSS.indexOf("{", at);
    return CSS.slice(open + 1, CSS.indexOf("}", open));
  }
  throw new Error(`styles.css 里应有单开一条的 ${selector} 规则`);
}

/** 取出某个媒体查询块的完整内容 */
function mediaBlock(query: string): string {
  const start = CSS.indexOf(`@media ${query}`);
  expect(start, `styles.css 里应有 @media ${query}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let i = CSS.indexOf("{", start);
  const bodyStart = i;
  for (; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return CSS.slice(bodyStart, i + 1);
}

describe("N-33 弹窗按钮列常驻可点", () => {
  const buttons = ruleBlock(".dialog-buttons");
  const dialog = ruleBlock(".dialog");

  it("按钮列 sticky 贴住弹窗可视底", () => {
    expect(buttons).toMatch(/position:\s*sticky/);
    // bottom 必须是 0:Chrome 的 sticky 约束框取滚动容器的内容盒,
    // 再补一次下内边距会把按钮整体上顶(实测 390×844 上移 24px,那就不是零回归了)
    expect(buttons).toMatch(/bottom:\s*0\s*;/);
  });

  it("按钮列有不透明底,滚上来的内容不会透到按钮下面", () => {
    expect(buttons).toMatch(/background:\s*#fff\b/i);
    expect(buttons).toMatch(/z-index:\s*[1-9]/);
  });

  it("上缘是透明→白的渐隐带,不溢出时与白底融为一体(宽屏零回归的前提)", () => {
    const fade = ruleBlock(".dialog-buttons::before");
    expect(fade).toMatch(/bottom:\s*100%/);
    expect(fade).toMatch(/linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\)/);
    // 渐隐带盖在内容上,不能吃掉点击
    expect(CSS).toMatch(/\.dialog-buttons::before,\s*\n\.dialog-buttons::after\s*\{[^}]*pointer-events:\s*none/);
  });

  it("下摆按弹窗自己的下内边距铺白,内容不会从按钮列和圆角之间的缝里露出来", () => {
    // 三档 padding(默认 / 340px 窄屏 / 560px 矮屏)统一抽成变量,下摆才跟得住
    expect(dialog).toMatch(/--dialog-pad-b:\s*24px/);
    expect(dialog).toMatch(/padding:\s*28px 24px var\(--dialog-pad-b\)/);
    expect(mediaBlock("(max-width: 340px)")).toMatch(/--dialog-pad-b:\s*18px/);
    expect(mediaBlock("(max-height: 560px)")).toMatch(/--dialog-pad-b:\s*16px/);

    const skirt = ruleBlock(".dialog-buttons::after");
    expect(skirt).toMatch(/top:\s*100%/);
    expect(skirt).toMatch(/height:\s*var\(--dialog-pad-b/);
  });

  it("弹窗本体的「整体可滚」兜底照留(sticky 只切边界,不取消滚动)", () => {
    expect(dialog).toMatch(/overflow-y:\s*auto/);
    expect(dialog).toMatch(/max-height:\s*86dvh/);
  });
});

describe("N-33 配套:矮横屏结算庆祝件收一档", () => {
  const short = mediaBlock("(max-height: 500px)");

  it("双吉祥物、大标题、星级、分数条都收了一档(内滚 109→6)", () => {
    expect(short).toMatch(/\.result-buddy\s*\{[^}]*width:\s*40px/);
    expect(short).toMatch(/\.result-title\s*\{[^}]*font-size:\s*21px/);
    expect(short).toMatch(/\.result-stars\s*\{[^}]*font-size:\s*26px/);
    expect(short).toMatch(/\.result-score\s*\{[^}]*font-size:\s*18px/);
  });

  it("取反:收的只是「读的」,按钮热区一个字没动(孩子面 44px 红线)", () => {
    // 矮屏档里不许出现给 .btn / .dialog-buttons .btn 压高度或字号的声明
    expect(short).not.toMatch(/\.dialog-buttons\s+\.btn/);
    expect(short).not.toMatch(/\.dialog-buttons\s*\{[^}]*min-height/);
    expect(short).not.toMatch(/\.dialog-buttons\s*\{[^}]*font-size/);
    // 只准调外边距与间距
    const own = short.slice(short.indexOf(".dialog-buttons {"));
    expect(own.slice(0, own.indexOf("}"))).toMatch(/^[^}]*margin-top[^}]*gap[^}]*$/s);
  });
});

describe("N-33 护栏:dialogs.ts 语义零触碰", () => {
  it("按钮列还是 .dialog-buttons,且仍旧是弹窗的最后一个孩子(sticky 才贴得住底)", () => {
    expect(DIALOGS_TS).toMatch(/row\.className = "dialog-buttons"/);
    // 建好按钮列后直接 append 到 dialog,后面不再追加别的块
    const at = DIALOGS_TS.indexOf('row.className = "dialog-buttons"');
    const rest = DIALOGS_TS.slice(at, DIALOGS_TS.indexOf("overlay.appendChild(dialog)"));
    expect(rest).toMatch(/dialog\.appendChild\(row\)/);
    expect(rest).not.toMatch(/dialog\.appendChild\((?!row\))/);
  });

  it("狂点冷静期还在,没被布局改动顺手拆掉", () => {
    expect(DIALOGS_TS).toMatch(/if \(isGuardedClick\(shownAt, env\.now\(\)\)\) return;/);
    expect(isGuardedClick(1000, 1000)).toBe(true);
    expect(isGuardedClick(1000, 1000 + CLICK_GUARD_MS)).toBe(false);
  });

  it("结算弹窗的两颗必点钮文案与顺序不变", () => {
    const at = DIALOGS_TS.indexOf("buttons: [", DIALOGS_TS.indexOf("export function showResultDialog"));
    const block = DIALOGS_TS.slice(at, at + 700);
    expect(block.indexOf("🔁 再玩一次")).toBeGreaterThan(0);
    expect(block.indexOf("🏠 回首页")).toBeGreaterThan(block.indexOf("🔁 再玩一次"));
  });
});
