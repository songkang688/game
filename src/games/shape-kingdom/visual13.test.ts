/**
 * 形状王国 · 1.3 视觉升级用例（第 25 步 B 档，只增不减）。
 *
 * 钉住第九节的 14 条红线：形状轮廓换肤前后一致（教育语义）、四色宝石三停渐变
 * 非平涂、2.5D 底部暗边、小格降级、城堡点亮 = 拼放进度映射、预放虚影只读既有
 * 校验、放对放错分支、HUD 文本一字不差、drawStars 回归、浮层不接指针、reduced
 * 全停、360px 布局、destroy 计时归零、既有判定原样。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { StubEl, findAll, findByLabel, findOne, installDom, totalListeners } from "./domStub";
import {
  dotBoardMetrics,
  drawMetrics,
  drawStars,
  ghostFootprint,
  judgeTiling,
  runDrawRound,
  type Placement,
  type RectTask,
  type TilingTask,
} from "./draw";
import {
  CASTLE_SEGMENTS,
  CONFETTI_COUNT,
  KINGDOM_CSS,
  castleSvg,
  confettiSpecs,
  cornerFlagSvg,
  litSegments,
  pieceBadgeSvg,
  tilingProgress,
} from "./kingdom";
import { GEM_STOPS, gemCellCss, gemFacetVisible, gemGradient } from "../../art/kit/gem";
import { sparkleCss } from "../../art/kit/sparkle";
import { sortedCells, cellSet, type CellKey } from "./geometry";
import { trio } from "./hints";
import type { PlayCtx } from "../level99";

let restoreDom: (() => void) | null = null;
afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  vi.useRealTimers();
});

function stubCtx(over: Partial<PlayCtx> = {}): PlayCtx {
  return {
    level: 0,
    chapterIndex: 0,
    indexInChapter: 0,
    sfx: () => {},
    bonusStars: () => {},
    win: () => {},
    lose: () => {},
    ...over,
  } as PlayCtx;
}

/** 标准拼骨牌题：3×2 轮廓，两根横三连 */
function tilingTask(): TilingTask {
  return {
    kind: "tiling",
    cols: 3,
    rows: 2,
    target: sortedCells(cellSet([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]])),
    pieces: [
      ["0,0", "0,1", "0,2"],
      ["0,0", "0,1", "0,2"],
    ],
    ask: "拼满轮廓",
    hints: trio("一二三四五六七八", "二二三四五六七八", "三二三四五六七八"),
  };
}

function mount(tasks: Array<TilingTask | RectTask>, over: { viewportWidth?: number; win?: (s: number) => void } = {}) {
  const dom = installDom();
  restoreDom = dom.restore;
  const stage = new StubEl("div");
  const handle = runDrawRound({
    stage: stage as unknown as HTMLElement,
    ctx: stubCtx(over.win ? { win: over.win } : {}),
    theme: { bg: "#f3f0ff", accent: "#5f3dc4" },
    tasks: tasks as never,
    viewportWidth: over.viewportWidth ?? 360,
  });
  return { stage, handle };
}

/** 皮肤样式全文（DRAW_CSS + 宝石 + 星屑 + 王国，落在 <style> 里的那份） */
function styleText(stage: StubEl): string {
  const wrap = findOne(stage, "shk-draw")!;
  const styleEl = wrap.children.find((c) => c.tagName === "style");
  expect(styleEl, "皮肤 <style> 不见了").toBeTruthy();
  return styleEl!.textContent;
}

function innerHtml(el: StubEl): string {
  return (el as unknown as { innerHTML?: string }).innerHTML ?? "";
}

// ---------------------------------------------------------------------------
// ① 形状轮廓换肤前后一致（教育语义钉死：三角就是三角，一个点不许改）
// ---------------------------------------------------------------------------

describe("视觉升级 · 形状轮廓与热区零位移", () => {
  it("拼骨牌棋盘：格子的位置 / 尺寸 / 热区与换肤前的公式逐项一致（快照断言）", () => {
    const task = tilingTask();
    const { stage } = mount([task]);
    const m = drawMetrics(360, task.cols, task.rows);
    const board = findOne(stage, "shk-board")!;
    // 板子本身的公式没换
    expect(board.style.width).toBe(`${(m.unit * task.cols).toFixed(0)}px`);
    expect(board.style.height).toBe(`${(m.unit * task.rows).toFixed(0)}px`);
    // 每一格都是按钮、位置与尺寸原公式原样（皮肤只换填充，不搬格子）
    const cells = findAll(board, "shk-cell");
    expect(cells).toHaveLength(task.target.length);
    task.target.forEach((key, i) => {
      const [r, c] = key.split(",").map(Number);
      expect(cells[i].tagName).toBe("button");
      expect(cells[i].style.left).toBe(`${(c * m.unit).toFixed(1)}px`);
      expect(cells[i].style.top).toBe(`${(r * m.unit).toFixed(1)}px`);
      expect(cells[i].style.width).toBe(`${(m.unit - 3).toFixed(1)}px`);
      expect(cells[i].style.height).toBe(`${(m.unit - 3).toFixed(1)}px`);
    });
  });

  it("点阵作图台：点的热区与位置公式也一个像素没动", () => {
    const task: RectTask = { kind: "rect", cols: 6, rows: 4, goal: "area", target: 12, ask: "画一个", hints: trio("一二三四五六七八", "二二三四五六七八", "三二三四五六七八") };
    const { stage } = mount([task]);
    const m = dotBoardMetrics(360, task.cols, task.rows);
    const pad = m.hit / 2;
    const dot = findByLabel(stage, "第 2 行第 3 列的点")!;
    expect(dot.style.width).toBe(`${m.hit.toFixed(0)}px`);
    expect(dot.style.height).toBe(`${m.hit.toFixed(0)}px`);
    expect(dot.style.left).toBe(`${(pad + 2 * m.unit - m.hit / 2).toFixed(1)}px`);
    expect(dot.style.top).toBe(`${(pad + 1 * m.unit - m.hit / 2).toFixed(1)}px`);
  });
});

// ---------------------------------------------------------------------------
// ②③ 四色宝石：三停渐变非平涂、两两不同、底部暗边（2.5D 厚度）
// ---------------------------------------------------------------------------

describe("视觉升级 · 宝石质感", () => {
  it("p0–p3 四色全走三停渐变（135° 受光），不是四张色纸", () => {
    const { stage } = mount([tilingTask()]);
    const css = styleText(stage);
    for (let i = 0; i < 4; i++) {
      expect(css).toContain(`.shk-gem-p${i}{background:${gemGradient(i)}`);
      expect(gemGradient(i)).toContain("linear-gradient(135deg,");
    }
  });

  it("四色渐变两两不同，底部 2px 暗边与 1.5px 深色描边都在（inset 阴影，盒子不动）", () => {
    const { stage } = mount([tilingTask()]);
    const css = styleText(stage);
    expect(new Set([0, 1, 2, 3].map((i) => gemGradient(i))).size).toBe(4);
    for (const stops of GEM_STOPS) {
      expect(css).toContain(`inset 0 -2px 0 ${stops[2]}`);
      expect(css).toContain(`inset 0 0 0 1.5px ${stops[2]}`);
    }
  });

  it("放对之后格子同时挂老四色类与宝石类——判定测试认的老类名一个没丢", () => {
    const { stage } = mount([tilingTask()]);
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("click");
    const cell = findByLabel(stage, "轮廓里第 1 行第 1 列")!;
    expect(cell.classList.contains("shk-cell-p0")).toBe(true);
    expect(cell.classList.contains("shk-gem-p0")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ④ 小格降级（360px 规则）：< 32px 无切面三角，渐变描边保留
// ---------------------------------------------------------------------------

describe("视觉升级 · 小格降级", () => {
  it("降级门槛走 gemFacetVisible：31px 不画切面、32px 起画", () => {
    expect(gemFacetVisible(31)).toBe(false);
    expect(gemFacetVisible(32)).toBe(true);
  });

  it("格子挤到 32px 以下时棋盘挂 shk-gem-small，CSS 把切面三角整块砍掉", () => {
    // cols=12 逼 unit = 280/12 ≈ 23px（< 32），正常 3 列棋盘不该降级
    const wide: TilingTask = { ...tilingTask(), cols: 12 };
    const { stage } = mount([wide], { viewportWidth: 300 });
    expect(findOne(stage, "shk-board")!.classList.contains("shk-gem-small")).toBe(true);
    const css = styleText(stage);
    expect(css).toContain(".shk-gem-small .shk-gem-p0::after");
    expect(css.slice(css.indexOf(".shk-gem-small"))).toContain("content:none");

    const { stage: normal } = mount([tilingTask()]);
    expect(findOne(normal, "shk-board")!.classList.contains("shk-gem-small")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ⑤ 城堡点亮段数 = 拼放进度映射（0 / 50% / 100% 三点钉死）
// ---------------------------------------------------------------------------

describe("视觉升级 · 城堡剪影逐段点亮", () => {
  it("纯映射：0 → 0 段，50% → 3 段，100% → 6 段", () => {
    expect(CASTLE_SEGMENTS).toBe(6);
    expect(litSegments(0)).toBe(0);
    expect(litSegments(0.5)).toBe(3);
    expect(litSegments(1)).toBe(6);
    expect(tilingProgress(3, 6)).toBe(0.5);
    expect(tilingProgress(0, 0)).toBe(0);
  });

  it("DOM 里跟着拼放进度走：开局 0 段，放一块亮 3 段，拼满亮 6 段", () => {
    const { stage } = mount([tilingTask()]);
    const kingdom = findOne(stage, "shk-kingdom")!;
    expect(innerHtml(kingdom)).toContain('data-lit="0"');
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("click");
    expect(innerHtml(kingdom)).toContain('data-lit="3"');
    findByLabel(stage, "轮廓里第 2 行第 1 列")!.fire("click");
    expect(innerHtml(kingdom)).toContain('data-lit="6"');
  });

  it("剪影是原创塔楼 + 垛口城墙：点亮用描金填充呈现（reduced 下结果照样在）", () => {
    const svg = castleSvg(3);
    expect(svg).toContain('data-segs="6"');
    expect((svg.match(/data-on="1"/g) ?? []).length).toBe(3);
    expect(svg).toContain('fill="#ffd93d"');
    expect(svg).toContain('fill="#b7a6cf"');
    // 全亮才升小旗（王国建成）；半亮没有
    expect(svg).not.toContain("data-banner");
    expect(castleSvg(6)).toContain('data-banner="1"');
  });
});

// ---------------------------------------------------------------------------
// ⑥ 预放虚影：只在既有校验通过的格子出现（校验逻辑不动，只读映射）
// ---------------------------------------------------------------------------

describe("视觉升级 · 预放虚影", () => {
  it("悬到能放的格子：虚影正好落在那一块会占住的格子上；挪走就消", () => {
    const { stage } = mount([tilingTask()]);
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("pointerenter");
    for (const label of ["第 1 行第 1 列", "第 1 行第 2 列", "第 1 行第 3 列"]) {
      const el = findByLabel(stage, `轮廓里${label}`)!;
      expect(el.classList.contains("shk-cell-ghost"), `${label} 该有虚影`).toBe(true);
      expect(el.classList.contains("shk-cell-ghost-p0")).toBe(true);
    }
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("pointerleave");
    expect(findAll(stage, "shk-cell-ghost")).toHaveLength(0);
  });

  it("校验不过的格子一格虚影都不亮：占住之后再悬上去是空的", () => {
    const task = tilingTask();
    const { stage } = mount([task]);
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("click");
    // 现在选中的是第 2 块，悬在已被占住的第一行——ghostFootprint 判 null
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("pointerenter");
    expect(findAll(stage, "shk-cell-ghost")).toHaveLength(0);
    // 纯函数口径一致：占住 → null；空行 → 三格
    const placed: Placement[] = [{ piece: 0, cells: ["0,0", "0,1", "0,2"] as CellKey[] }];
    expect(ghostFootprint(task, placed, 1, 0, 0, 0)).toBeNull();
    expect(ghostFootprint(task, placed, 1, 0, 1, 0)).toEqual(["1,0", "1,1", "1,2"]);
  });
});

// ---------------------------------------------------------------------------
// ⑦ 放对 / 放错走不同视觉分支，placements 数据不变
// ---------------------------------------------------------------------------

describe("视觉升级 · 落定与弹回", () => {
  it("放错：点中的格子摇头（shk-cell-deny），一格都没涂色，鼓励语原文原样", () => {
    vi.useFakeTimers();
    const { stage } = mount([tilingTask()]);
    // 横三连锚在 (1,2)：会伸出轮廓，走的是放错分支
    findByLabel(stage, "轮廓里第 2 行第 3 列")!.fire("click");
    expect(findByLabel(stage, "轮廓里第 2 行第 3 列")!.classList.contains("shk-cell-deny")).toBe(true);
    expect(findAll(stage, "shk-cell-p0")).toHaveLength(0);
    expect(findAll(stage, "shk-cell-p1")).toHaveLength(0);
    expect(findOne(stage, "shk-msg")!.textContent).toBe("这一块放不进去，换个位置或者转一下～");
    // 摇头是一阵，340ms 后自己收回去
    vi.advanceTimersByTime(400);
    expect(findAll(stage, "shk-cell-deny")).toHaveLength(0);
  });

  it("放对：吸附落定（shk-cell-landed）+ 四角星闪，动画收尾后类名摘干净", () => {
    vi.useFakeTimers();
    const { stage } = mount([tilingTask()]);
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("click");
    const landed = findAll(stage, "shk-cell-landed");
    expect(landed).toHaveLength(3);
    const pop = findOne(stage, "shk-starpop")!;
    expect(pop, "四角星闪层没出来").not.toBeNull();
    expect(findAll(pop, "shk-spark")).toHaveLength(4);
    vi.advanceTimersByTime(600);
    expect(findAll(stage, "shk-cell-landed")).toHaveLength(0);
    expect(findOne(stage, "shk-starpop")).toBeNull();
  });

  it("拾起态在按钮内层抬升（热区盒子不动），落定 220ms 回弹、弹回 320ms 摇头都写在 CSS 里", () => {
    const { stage } = mount([tilingTask()]);
    const css = styleText(stage);
    expect(css).toContain(".shk-piece-on .shk-piece-face{transform:translateY(-4px) scale(1.05);}");
    expect(css).toContain(".shk-cell-landed{animation:shkLand .22s cubic-bezier(.34,1.56,.64,1);}");
    expect(css).toContain(".shk-cell-deny{animation:shkDeny .32s ease-out;}");
    expect(css).toContain("rotate(3deg)");
    expect(css).toContain("rotate(-3deg)");
    // 骨牌按钮里真的有 face 内层与小剪影
    const piece = findAll(stage, "shk-piece")[0];
    expect(findOne(piece, "shk-piece-face")).not.toBeNull();
    expect(innerHtml(findOne(piece, "shk-piece-art")!)).toContain("<svg");
  });
});

// ---------------------------------------------------------------------------
// ⑧ HUD 卡片化后文本一字不差
// ---------------------------------------------------------------------------

describe("视觉升级 · HUD 文本回归", () => {
  it("顶栏两枚徽章与读数行的文案原文原样", () => {
    const { stage } = mount([tilingTask()]);
    const badges = findAll(stage, "shk-badge");
    expect(badges.map((b) => b.textContent)).toEqual(["第 1 / 1 题", "🏰 城堡 0 层"]);
    expect(findOne(stage, "shk-readout")!.textContent).toBe(
      "选中第 1 块（第 1 / 2 种摆法），点轮廓里的格子放下去"
    );
    const label = findOne(stage, "shk-piece-label")!;
    expect(label.textContent).toBe("第 1 块 · 3 格");
  });

  it("卡片壳只落在 CSS 上：badge / readout 有卡片样式，字号守住 14px", () => {
    const { stage } = mount([tilingTask()]);
    const css = styleText(stage);
    expect(css).toContain(".shk-badge{background:#fffdf7;border:1.5px solid #e8dfc9");
    expect(css).toContain(".shk-readout{background:rgba(255,255,255,.88)");
    const badgeCard = css.slice(css.indexOf(".shk-badge{background:#fffdf7"));
    expect(badgeCard.slice(0, badgeCard.indexOf("}"))).toContain("font-size:14px");
  });
});

// ---------------------------------------------------------------------------
// ⑨ drawStars 回归 + 完成仪式（升旗 / 彩纸 / 星星逐颗弹入）
// ---------------------------------------------------------------------------

describe("视觉升级 · 完成仪式", () => {
  it("drawStars 的评价逻辑原样：全对 3 星、错一半以内 2 星、更多 1 星", () => {
    expect(drawStars(0, 4)).toBe(3);
    expect(drawStars(1, 4)).toBe(2);
    expect(drawStars(2, 4)).toBe(2);
    expect(drawStars(3, 4)).toBe(1);
    expect(drawStars(1, 1)).toBe(2);
  });

  it("一关拼满：城堡全亮 + 升旗 + 彩纸 20 粒 + 星星数与 drawStars 一致且逐颗错峰", () => {
    vi.useFakeTimers();
    const { stage } = mount([tilingTask()]);
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("click");
    findByLabel(stage, "轮廓里第 2 行第 1 列")!.fire("click");
    const goBtn = findAll(stage, "shk-btn").find((b) => b.textContent.startsWith("✅"))!;
    goBtn.fire("click");
    const fete = findOne(stage, "shk-fete")!;
    expect(fete, "完成仪式浮层没出来").not.toBeNull();
    expect(findOne(fete, "shk-fete-flagcloth")).not.toBeNull();
    expect(findAll(fete, "shk-confetti")).toHaveLength(CONFETTI_COUNT);
    const stars = findAll(fete, "shk-fete-star");
    expect(stars).toHaveLength(drawStars(0, 1));
    const delays = stars.map((s) => Number.parseInt(s.style.animationDelay, 10));
    for (let i = 1; i < delays.length; i++) expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    expect(innerHtml(findOne(stage, "shk-kingdom")!)).toContain(`data-lit="${CASTLE_SEGMENTS}"`);
  });

  it("彩纸轨迹是确定性纯参数：同一个 rand 两次一模一样，正好 20 粒、四色轮着用", () => {
    const rand = () => 0.5;
    const a = confettiSpecs(rand);
    expect(a).toHaveLength(CONFETTI_COUNT);
    expect(a).toEqual(confettiSpecs(rand));
    expect(new Set(a.map((s) => s.colorIndex))).toEqual(new Set([0, 1, 2, 3]));
  });
});

// ---------------------------------------------------------------------------
// ⑩ 浮层与装饰层全部 pointer-events:none（不挡拖拽）
// ---------------------------------------------------------------------------

describe("视觉升级 · 浮层不接指针", () => {
  it("场景 / 城堡层 / 星闪 / 仪式 / 小旗 / 拾起影子，规则里全是 pointer-events:none", () => {
    for (const sel of [".shk-scene{", ".shk-kingdom{", ".shk-starpop{", ".shk-fete{", ".shk-flag{", ".shk-piece-on::after{"]) {
      const at = KINGDOM_CSS.indexOf(sel);
      expect(at, `${sel} 规则不见了`).toBeGreaterThanOrEqual(0);
      const rule = KINGDOM_CSS.slice(at, KINGDOM_CSS.indexOf("}", at));
      expect(rule, `${sel} 没写 pointer-events:none`).toContain("pointer-events:none");
    }
    // 星屑走 sparkle 套件：它自带 pointer-events: none
    expect(sparkleCss("shk")).toContain("pointer-events: none");
  });

  it("装饰节点不挂任何监听：destroy 后整棵树监听归零（拖拽路径没被皮肤占用）", () => {
    const { stage, handle } = mount([tilingTask()]);
    const scene = findOne(stage, "shk-scene")!;
    expect(scene.listenerCount).toBe(0);
    expect(findOne(stage, "shk-kingdom")!.listenerCount).toBe(0);
    handle.destroy();
    expect(totalListeners(stage)).toBe(0);
    expect(stage.children).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ⑪ prefers-reduced-motion：吸附 / 升旗 / 云移 / 点亮过渡 / 彩纸全停
// ---------------------------------------------------------------------------

describe("视觉升级 · reduced 全停", () => {
  it("reduce 块里逐条关停，静态质感与点亮结果保留", () => {
    const at = KINGDOM_CSS.indexOf("@media (prefers-reduced-motion:reduce)");
    expect(at).toBeGreaterThanOrEqual(0);
    const block = KINGDOM_CSS.slice(at, KINGDOM_CSS.indexOf("\n}", at));
    for (const sel of [".shk-cloud", ".shk-seg-new", ".shk-cell-landed", ".shk-cell-deny", ".shk-fete-flagcloth", ".shk-fete-star"]) {
      const ruleAt = block.indexOf(`${sel}{`);
      expect(ruleAt, `reduce 块里没关 ${sel}`).toBeGreaterThanOrEqual(0);
      expect(block.slice(ruleAt, block.indexOf("}", ruleAt))).toContain("animation:none");
    }
    expect(block).toContain(".shk-confetti{display:none;}");
    // 星闪退成静态星点（sparkle 默认整颗藏掉，这里放回静态样子）
    expect(block).toContain(".shk-starpop .shk-spark{display:inline;animation:none");
    // 升旗用 from{translateY} 收进 keyframes：动画一停旗子就在顶上（旗到顶）
    expect(KINGDOM_CSS).toContain("@keyframes shkFlagUp{from{transform:translateY(26px)}to{transform:translateY(0)}}");
    // 点亮结果是 fill 属性不是动画：reduced 下照样呈现
    expect(castleSvg(3)).toContain('fill="#ffd93d"');
  });
});

// ---------------------------------------------------------------------------
// ⑫ 360px 布局：顶栏一行放得下、形状架不遮棋盘
// ---------------------------------------------------------------------------

describe("视觉升级 · 360px 布局", () => {
  it("棋盘不超可用宽，顶栏只有两枚卡片，形状架在 dock 里棋盘外", () => {
    const { stage } = mount([tilingTask()], { viewportWidth: 360 });
    const board = findOne(stage, "shk-board")!;
    expect(Number.parseFloat(board.style.width)).toBeLessThanOrEqual(360 - 40);
    expect(findOne(stage, "shk-draw-top")!.children).toHaveLength(2);
    // 形状架住在 dock（棋盘下方那一摞）里，不盖在棋盘上
    const dock = findOne(stage, "shk-dock")!;
    expect(findOne(dock, "shk-rack-row")).not.toBeNull();
    expect(findOne(findOne(stage, "shk-boardwrap")!, "shk-rack-row")).toBeNull();
    // 王国剪影层限宽 + 窄屏那档收到 88%
    expect(KINGDOM_CSS).toContain("width:min(244px,82%)");
    expect(KINGDOM_CSS).toContain("@media (max-width:380px)");
  });
});

// ---------------------------------------------------------------------------
// ⑬ destroy 后动画计时器归零
// ---------------------------------------------------------------------------

describe("视觉升级 · destroy 收尸", () => {
  it("摇头 / 星闪 / 仪式的计时器全走 later：destroy 一声全清", () => {
    vi.useFakeTimers();
    const { stage, handle } = mount([tilingTask()]);
    // 放错一次（摇头计时）+ 放对两块（落定 / 星闪计时）+ 交卷（仪式 + 换题计时）
    findByLabel(stage, "轮廓里第 2 行第 3 列")!.fire("click");
    findByLabel(stage, "轮廓里第 1 行第 1 列")!.fire("click");
    findByLabel(stage, "轮廓里第 2 行第 1 列")!.fire("click");
    findAll(stage, "shk-btn").find((b) => b.textContent.startsWith("✅"))!.fire("click");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    handle.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ⑭ 既有拼放判定原样（全量回归由 npm test 兜底，这里再钉一遍口径）
// ---------------------------------------------------------------------------

describe("视觉升级 · 判定零改动", () => {
  it("judgeTiling 的口径原样：拼满算对、重叠 / 出界 / 少一块都不算", () => {
    const task = tilingTask();
    const full: Placement[] = [
      { piece: 0, cells: ["0,0", "0,1", "0,2"] as CellKey[] },
      { piece: 1, cells: ["1,0", "1,1", "1,2"] as CellKey[] },
    ];
    expect(judgeTiling(task, full)).toBe(true);
    expect(judgeTiling(task, full.slice(0, 1))).toBe(false);
    expect(
      judgeTiling(task, [full[0], { piece: 1, cells: ["0,0", "0,1", "0,2"] as CellKey[] }])
    ).toBe(false);
  });

  it("小旗 / 骨牌小剪影是纯 SVG 字符串（无位图、无商标字样）", () => {
    for (const svg of [cornerFlagSvg(), pieceBadgeSvg(["0,0", "0,1"] as CellKey[], 1), castleSvg(6)]) {
      expect(svg).toContain("<svg");
      expect(svg).not.toMatch(/<image|data:image|\.png|\.jpg/i);
      expect(svg.toLowerCase()).not.toMatch(/disney|mickey/);
    }
  });
});
