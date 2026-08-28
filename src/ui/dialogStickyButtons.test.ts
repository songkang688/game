/**
 * N-33(trio-r9 测试修复员 A · 复测守门):
 * 壳层结算弹窗在矮横屏上「再玩一次 / 回首页」够不着。
 *
 * 真机 Chrome 无头,把一份真实结算弹窗 DOM 原样重放到八档视口(配方 I):
 *   修前 915×412 弹窗 16–396、内滚 119px,两颗必点钮落在 395–439 / 451–495 ——
 *   **整整两颗都在弹窗可视底之外**,不滚到底根本点不着;844×390 同样两颗,320×568 切半一颗。
 *
 * 上游 r12 一带已按配方 I 修好:`.dialog-buttons` 粘在弹窗可视底,正文照旧滚。
 * 本轮 A 复测通过,同一批重放:
 *   915×412 够不着 2→0 / 切半 2→0(钮回到 276–320、332–376,都在弹窗里)
 *   844×390 够不着 2→0 / 切半 2→0 | 320×568 切半 1→0
 *   390×844 / 412×915 / 1024×768 / 1280×800 / 360×640 逐像素一模一样(本来就不溢出)。
 *
 * 这里只钉守门:弹窗是全库共享件,`dialogs.ts` 的按钮语义与 `isGuardedClick` 一个字不许动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const DIALOGS = readFileSync(new URL("./dialogs.ts", import.meta.url), "utf8");

/** 取一条独立规则的声明块(跳过「逗号并列」里的同名选择器) */
function ruleBlock(selector: string): string {
  const re = new RegExp(`(^|[},/*\\s])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m");
  const m = re.exec(CSS);
  expect(m, `应有 ${selector} 规则`).not.toBeNull();
  const open = CSS.indexOf("{", m!.index);
  const close = CSS.indexOf("}", open);
  return CSS.slice(open + 1, close);
}

describe("N-33 结算弹窗按钮列常驻可点", () => {
  const btns = ruleBlock(".dialog-buttons");

  it("按钮列粘在弹窗可视底,正文再长也不把它顶出去", () => {
    expect(btns).toMatch(/position:\s*sticky/);
    expect(btns).toMatch(/bottom:\s*0/);
  });

  it("按钮列有不透明底和层级,滚上来的内容不会透到按钮下面", () => {
    expect(btns).toMatch(/background:\s*#ffffff/i);
    const z = /z-index:\s*(\d+)/.exec(btns);
    expect(z, "应有 z-index").not.toBeNull();
    expect(Number(z?.[1])).toBeGreaterThanOrEqual(1);
  });

  it("按钮列上下都罩住:上缘有白色投影带,内容不从缝里露出来", () => {
    expect(btns).toMatch(/box-shadow:[^;]*#ffffff/i);
    expect(btns).toMatch(/padding-top:\s*\d+px/);
  });

  it("弹窗本体还是「限高 + 自己滚」,粘底不是靠取消滚动实现的", () => {
    const dialog = ruleBlock(".dialog");
    expect(dialog).toMatch(/max-height:\s*86dvh/);
    expect(dialog).toMatch(/overflow-y:\s*auto/);
  });

  it("取反:按钮热区一个字没动(孩子面 44px 红线)", () => {
    // 粘底只准改「按钮列怎么摆」,不准顺手把按钮压扁去腾地方
    expect(btns).not.toMatch(/min-height/);
    expect(btns).not.toMatch(/font-size/);
    expect(btns).not.toMatch(/transform:\s*scale/);
  });

  it("取反:按钮列还是纵向排列,顺序与间距没被粘底改掉", () => {
    expect(btns).toMatch(/flex-direction:\s*column/);
    expect(btns).toMatch(/gap:\s*12px/);
  });
});

describe("N-33 红线:dialogs.ts 语义零触碰", () => {
  it("按钮列的类名与容器还是原来那个", () => {
    expect(DIALOGS).toContain("dialog-buttons");
  });

  it("误触防抖还在(结算弹窗一冒出来就被连点会直接跳过)", () => {
    expect(DIALOGS).toMatch(/isGuardedClick/);
  });

  it("结算弹窗的按钮文案与先后次序没动", () => {
    const at = DIALOGS.indexOf("showResultDialog");
    expect(at).toBeGreaterThan(-1);
    const body = DIALOGS.slice(at);
    // 认 label 那一份,别认注释里顺口提到的同名词
    const again = body.indexOf('label: "🔁 再玩一次"');
    const home = body.indexOf('label: "🏠 回首页"');
    expect(again, "应有「再玩一次」").toBeGreaterThan(-1);
    expect(home, "应有「回首页」").toBeGreaterThan(-1);
    expect(again).toBeLessThan(home);
  });
});
