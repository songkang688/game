/**
 * 红蓝点点 · 模式条只在选关地图上露面
 * （1.2 窗口5 · 第 2 轮 · 档B 监督修复员，`W5R2-FB-03` 严重）。
 *
 * `b4324a7` 给 `poop-hero` / `red-blue-tug` / `find-diff` / `kitty-care` 四款
 * 补上了「关卡在跑时侧模式入口点响了也不许开」（档C 的 `W5R2-C-06`）。
 * 本款不在那四款里，于是本轮独立复量了一遍——**这一款比那四款还差一档**：
 * 那四款至少 `bar.hidden = true` 把手指挡住了，本款**连藏都没藏**。
 *
 * 真机 CDP 实测（第 40 关，390×844，关卡正在跑）：
 *
 * ```
 * .rte-bar          hidden=false，高 60px，就摆在关卡上方
 * ⚔️ 双人对战        elementFromPoint 命中，disabled=false
 * ♾️ 点到手软        elementFromPoint 命中，disabled=false
 * 点一下 ⚔️ 之后      .rbt-arena 还在（只被 hidden 藏起来），.rbt-vs 同时出现
 * 关内小电脑分数      2.5 秒里从 0 走到 1 —— **两套同时在跑**
 * ```
 *
 * 也就是说：孩子在关卡里手一滑点到 `⚔️`，对战屏盖上来，而底下那一关的秒表、
 * 小电脑的 AI、点的生灭全都没停。等他从对战退回去，那一关可能已经输了。
 *
 * 修法照抄 `b4324a7`：关卡在跑就把这一条收起来，**并且**点响了也不开
 * （`hidden` 挡的是手指，挡不住焦点残留、壳层补发的 click 与自动化脚本）。
 * 顺带把横屏那 50px 还给竞技场——这一条一收，`.rbt-arena` 头顶就多出
 * 一整条的高度（见 `arenaFit.test.ts` 里横屏那一组）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = fileURLToPath(new URL(".", import.meta.url));
const SRC = readFileSync(`${dir}index.ts`, "utf8");

/** `mount()` 里接 `mountLevelGame` 的那一段（关卡生死就写在这儿） */
const WIRED = SRC.slice(SRC.indexOf("const level = mountLevelGame("));

/** 两颗侧模式入口的点击处理 */
const OPEN_SIDE = SRC.slice(SRC.indexOf("function openSide("), SRC.indexOf("versusBtn.addEventListener"));

describe("红蓝点点 · 模式条只在选关地图上露面（W5R2-FB-03）", () => {
  it("关卡一开就把模式条收起来，关卡一销毁就放回来", () => {
    expect(WIRED).toContain("bar.hidden = true");
    expect(WIRED).toContain("inLevel = true;");
    // 收要排在 playLevel() 之前：竞技场是在 playLevel 里按可视高收的，
    // 量早了这 50px 没人认领，收完还得再量一次
    expect(WIRED.indexOf("bar.hidden = true")).toBeLessThan(WIRED.indexOf("playLevel(stage, ctx)"));
  });

  it("光藏起来不算数：关卡在跑时两颗入口点响了也不许开", () => {
    expect(SRC).toContain("let inLevel = false;");
    expect(OPEN_SIDE, "openSide 少了「关卡在跑就不开」这道闸").toContain("if (side || inLevel) return;");
    // 闸要排在改 hidden 与真正挂载之前，否则闸住了也已经把关卡层藏了
    expect(OPEN_SIDE.indexOf("if (side || inLevel) return;")).toBeLessThan(
      OPEN_SIDE.indexOf("levelHost.hidden = true")
    );
    expect(OPEN_SIDE.indexOf("if (side || inLevel) return;")).toBeLessThan(OPEN_SIDE.indexOf("side = mountFn("));
  });

  it("关卡销毁时先落 inLevel 再销毁，顺序反了闸会漏一拍", () => {
    expect(WIRED).toContain("inLevel = false;");
    expect(WIRED.indexOf("inLevel = false;")).toBeLessThan(WIRED.indexOf("handle?.destroy?.()"));
  });

  it("侧模式关掉时别替关卡把模式条放回来", () => {
    // 从地图开的侧模式退出 → 回地图，条该露面；
    // 真出现「关卡在跑 + 侧模式开着」时（撬开硬点）退出也不能把条放回关卡上面
    const closeSide = SRC.slice(SRC.indexOf("function closeSide("), SRC.indexOf("function openSide("));
    expect(closeSide).toContain("bar.hidden = inLevel;");
  });

  it("`hidden` 得真的藏得住——`display:flex` 会把浏览器自带的那条盖掉", () => {
    // 复测第一版补丁时真机量到的：`bar.hidden` 已经是 `true`，可 `.rte-bar` 高**还是 60px**、
    // 两颗入口 `elementFromPoint` 照旧命中。原因是 `.rte-bar{display:flex}` 的优先级
    // 高过 UA 样式表里的 `[hidden]{display:none}`，属性写了等于没写。
    // 闸（`if (side || inLevel) return;`）挡住了「点响就开」，可这 50px 还占着，
    // 横屏上竞技场缺的正是它。
    const at = SRC.indexOf(".rte-bar[hidden]");
    expect(at, "少了 .rte-bar[hidden] 这一条").toBeGreaterThan(-1);
    expect(SRC.slice(at, SRC.indexOf("\n", at))).toContain("display: none");
    // 要排在 .rte-bar 那条之后，不然被它盖回去
    expect(SRC.indexOf(".rte-bar {")).toBeLessThan(at);
    // 藏起来那条不许顺手改尺寸
    expect(SRC.slice(at, SRC.indexOf("\n", at))).not.toContain("min-height");
  });

  it("热区没动：两颗入口回到地图上仍旧 ≥44px", () => {
    const at = SRC.indexOf(".rte-open {");
    const decl = SRC.slice(at, SRC.indexOf("\n", at));
    expect(decl).toContain("padding: 10px 20px");
    expect(decl).toContain("font-size: 15px");
  });
});
