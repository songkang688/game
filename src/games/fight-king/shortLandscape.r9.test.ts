/**
 * 朵星格斗王 · 三人组第 9 轮 测试修复员 B · N-25（格斗塔）+ N-31（训练场）修后钉子。
 *
 * 修前实测（915×412，`.game-stage` clientHeight = 322）：
 * - 塔第 1 关裁 498、canvas 出屏 335，轻击 / 重击 / 必杀 / 防御 整排折叠线下；
 * - 训练场开打后裁 801（触屏键排默认开着），两排 8 键 + 假人 3 钮全线下。
 *
 * 修法（r6 配方 G 之 ①「横屏双栏」）：对局壳 `.fk-fight` 在矮横屏改网格，
 * 摇杆挪到画面两侧、训练场教学面板限高自滚（假人行 sticky 钉顶），
 * 塔壳的「出战角色」八宫格按「舞台真的裁了没」自动折进一颗按钮。
 *
 * 修后实测：塔 6 / 训练 0 / 双人 0 / 人机 0 / 无尽 0，五模式折叠线下均为 0。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { shouldFoldHeroGrid } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 取一段媒体查询里的声明（到该查询的收尾大括号为止） */
function mediaBlock(head: string): string {
  const at = src.indexOf(head);
  expect(at, `找不到媒体查询 ${head}`).toBeGreaterThan(0);
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  throw new Error(`媒体查询 ${head} 没有配对的大括号`);
}

const SHORT = "@media (min-width:700px) and (max-height:560px)";

describe("N-25/N-31 · 矮横屏对局壳双栏（配方 G）", () => {
  it("媒体查询只咬 915×412 一族：竖屏三档与 1024×768 / 1280×800 全部不进这条分支", () => {
    // 门槛写死在选择器里，测的是「谁会命中」：宽 ≥700 且高 ≤560 才算矮横屏
    const hits = (w: number, h: number): boolean => w >= 700 && h <= 560;
    expect(hits(915, 412)).toBe(true);
    expect(hits(360, 640)).toBe(false);
    expect(hits(390, 844)).toBe(false);
    expect(hits(412, 915)).toBe(false);
    expect(hits(1024, 768)).toBe(false);
    expect(hits(1280, 800)).toBe(false);
    expect(src).toContain(SHORT);
  });

  it("矮横屏把摇杆放到画面左右两侧：pads 容器让位，两块摇杆各占一栏", () => {
    const block = mediaBlock(SHORT);
    expect(block).toContain(".fk-fight>.fk-pads{display:contents;}");
    expect(block).toContain('grid-template-areas:"bar bar bar" "padA stage padB" "padA train padB"');
    expect(block).toContain(".fk-fight>.fk-pads>.fk-pad:first-child{grid-area:padA;}");
    expect(block).toContain(".fk-fight>.fk-pads>.fk-pad:last-child{grid-area:padB;}");
  });

  it("训练场教学面板限高自滚，「假人」切换行 sticky 钉在面板顶上（读的能滚，按的够得着）", () => {
    const block = mediaBlock(SHORT);
    expect(block).toMatch(/\.fk-fight>\.fk-card\{grid-area:train;max-height:\d+dvh;overflow-y:auto/);
    expect(block).toContain(".fk-fight>.fk-card>.fk-train-modes{position:sticky;top:0;");
  });

  it("常规档一个像素都不动：双栏声明只出现在矮横屏媒体查询里", () => {
    const block = mediaBlock(SHORT);
    const outside = src.replace(block, "");
    expect(outside).not.toContain("grid-area:padA");
    expect(outside).not.toContain("display:contents");
    expect(outside).not.toContain("max-height:28dvh");
  });

  it("摇杆热区不因挪位缩水：矮横屏没有改写 .fk-padbtn 的 min-height", () => {
    const block = mediaBlock(SHORT);
    expect(block).not.toContain(".fk-padbtn{");
    expect(src).toContain(".fk-padbtn{border:none;border-radius:14px;padding:12px 4px;min-height:44px;");
  });
});

describe("N-25 · 画面外面多套一层 stagecol，钳高才量得出天然宽", () => {
  it("画面盒子外层是不参与钳制的 .fk-stagecol，钳的仍是 .fk-stage", () => {
    expect(src).toContain('const stageCol = el("div", "fk-stagecol");');
    expect(src).toContain("stageCol.appendChild(stage);");
    expect(src).toContain("wrap.appendChild(stageCol);");
    // 钳宽写的还是 stage 自己
    expect(src).toContain("stage.style.maxWidth = px;");
  });

  it("可视余量按 stagecol 的下沿算：摇杆挪到两侧后不再被当成「画面下面的家当」", () => {
    expect(src).toContain("const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(colRect));");
    expect(src).toContain("const room = clip - colRect.top - below;");
    expect(src).toContain("const cssW = stageCol.clientWidth || wrap.clientWidth || 0;");
  });

  it("上探层数留够 16 层：塔里画面到 .game-stage 正好压在原来的 10 层边上", () => {
    const fn = src.slice(src.indexOf("function stageClipBottom()"));
    expect(fn.slice(0, 400)).toContain("for (let i = 0; node && i < 16; i++)");
  });
});

describe("N-25 · 出战角色八宫格自动折叠（shouldFoldHeroGrid）", () => {
  it("舞台裁了才折，装得下的档一个像素都不动", () => {
    expect(shouldFoldHeroGrid(498, false)).toBe(true);
    expect(shouldFoldHeroGrid(9, false)).toBe(true);
    expect(shouldFoldHeroGrid(8, false)).toBe(false);
    expect(shouldFoldHeroGrid(0, false)).toBe(false);
  });

  it("玩家自己点开过就永远听玩家的：再裁也不背着人折回去", () => {
    expect(shouldFoldHeroGrid(498, true)).toBe(false);
    expect(shouldFoldHeroGrid(0, true)).toBe(false);
  });

  it("量不出数（NaN）时不动手", () => {
    expect(shouldFoldHeroGrid(Number.NaN, false)).toBe(false);
  });

  it("只在关内折：选关地图是设计内的长滚页，它裁多少都不牵连换人格", () => {
    expect(src).toContain("if (!inLevel || !heroOpen) return;");
    expect(src).toContain("inLevel = true;");
    expect(src).toContain("inLevel = false;");
  });

  it("折起来时那颗按钮报得出当前出战是谁，可展开语义齐全", () => {
    expect(src).toContain("`🥊 出战：${name} ${heroOpen ? \"▴\" : \"▾\"}`");
    expect(src).toContain('heroToggle.setAttribute("aria-expanded"');
  });

  it("「换个小伙伴试试」的提示写在格子里：提示一出现就摊开，而且不许再自动折回去", () => {
    const at = src.indexOf("swapTip.textContent = SWAP_HINT_TEXT;");
    expect(at).toBeGreaterThan(0);
    const after = src.slice(at, at + 260);
    expect(after).toContain("heroUserOpened = true;");
    expect(after).toContain("setHeroOpen(true);");
  });

  it("resize 监听有摘钩，退出塔壳不留监听", () => {
    expect(src).toContain('globalThis.addEventListener?.("resize", onResize);');
    expect(src).toContain('globalThis.removeEventListener?.("resize", onResize);');
  });
});
