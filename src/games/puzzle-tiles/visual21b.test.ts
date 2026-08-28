/**
 * 拼图乐园 · 1.3 第 21 步 B 档视觉用例(只增不减)。
 * 只测视觉层:token / 图层序 / 齿形皮肤 / 反馈分支 / 虚影只读 / reduced / FX 清理。
 * 玩法判定(解算 / 校验 / 关卡数据)的既有断言一个没动。
 */
import { describe, expect, it } from "vitest";
import { jigsawRadiusPct } from "../../art/kit/jigsaw";
import { cellCenter, nearestCell, snapThreshold, type GridGeom } from "./snap";
import {
  PT_CSS,
  PT_LAYERS,
  PT_TIMING,
  PT_TOKENS,
  PtFx,
  confettiHtml,
  dropFxClasses,
  ghostTarget,
  modeTagHtml,
  framingOverlayHtml,
  pieceSkinSvg,
  stepAngle,
} from "./visual";

describe("拼图乐园 · 1.3 视觉 · token 与图层", () => {
  it("--pt- 配色 token 全部落在样式表里,色值逐字对上", () => {
    expect(PT_TOKENS["--pt-easel"]).toBe("#EFE4D4");
    expect(PT_TOKENS["--pt-frame"]).toBe("#C89B6C");
    expect(PT_TOKENS["--pt-piece-edge"]).toBe("rgba(255,255,255,.5)");
    expect(PT_TOKENS["--pt-ghost"]).toBe("rgba(244,133,159,.3)");
    expect(PT_TOKENS["--pt-slot"]).toBe("inset 0 2px 4px rgba(0,0,0,.12)");
    expect(PT_TOKENS["--pt-glow"]).toBe("rgba(255,214,120,.5)");
    expect(PT_TOKENS["--pt-seam"]).toBe("#FFFFFF");
    for (const [k, v] of Object.entries(PT_TOKENS)) {
      expect(PT_CSS).toContain(`${k}: ${v};`);
    }
  });

  it("动效时长写成自定义属性进样式表(四·补三时序表)", () => {
    expect(PT_TIMING.liftMs).toBe(80);
    expect(PT_TIMING.snapMs).toBe(150);
    expect(PT_TIMING.shakeMs).toBe(240);
    expect(PT_TIMING.rotMs).toBe(120);
    expect(PT_TIMING.slideMs).toBe(90);
    expect(PT_TIMING.mountMs).toBe(300);
    for (const key of ["--pt-lift-ms: 80ms", "--pt-snap-ms: 150ms", "--pt-shake-ms: 240ms", "--pt-rot-ms: 120ms", "--pt-slide-ms: 90ms", "--pt-mount-ms: 300ms"]) {
      expect(PT_CSS).toContain(key);
    }
  });

  it("DOM 图层序从画室底到装裱浮层严格递增", () => {
    const order = [
      PT_LAYERS.easel,
      PT_LAYERS.slots,
      PT_LAYERS.placed,
      PT_LAYERS.ghost,
      PT_LAYERS.lift,
      PT_LAYERS.fx,
      PT_LAYERS.hud,
      PT_LAYERS.mount,
    ];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    expect(PT_CSS).toContain(`z-index: ${PT_LAYERS.hud}`);
    expect(PT_CSS).toContain(`z-index: ${PT_LAYERS.mount}`);
  });
});

describe("拼图乐园 · 1.3 视觉 · 齿形皮肤只裁不动热区", () => {
  it("皮肤是 pointer-events:none 的裁剪层,svg 对读屏隐藏", () => {
    expect(PT_CSS).toMatch(/\.pzv-skin \{[^}]*pointer-events: none/);
    const svg = pieceSkinSvg({ rows: 3, cols: 3, r: 1, c: 1, bg: "#FFD9E8", cellPx: 64, seed: 5 });
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('class="pzv-skin"');
  });

  it("皮肤外扩量跟齿形半径两档走:64px 块 -18%,36px 小块 -14%", () => {
    const big = pieceSkinSvg({ rows: 3, cols: 3, r: 0, c: 0, bg: "#fff", cellPx: 64, seed: 1 });
    const small = pieceSkinSvg({ rows: 3, cols: 3, r: 0, c: 0, bg: "#fff", cellPx: 36, seed: 1 });
    expect(jigsawRadiusPct(64)).toBe(18);
    expect(jigsawRadiusPct(36)).toBe(14);
    expect(big).toContain("inset:-18%");
    expect(small).toContain("inset:-14%");
  });

  it("同一块两次生成的齿形路径一字不差(渐变 id 以外全确定)", () => {
    const dOf = (s: string): string => /<path d="([^"]+)"/.exec(s)?.[1] ?? "";
    const a = dOf(pieceSkinSvg({ rows: 4, cols: 4, r: 2, c: 1, bg: "#fff", cellPx: 60, seed: 9 }));
    const b = dOf(pieceSkinSvg({ rows: 4, cols: 4, r: 2, c: 1, bg: "#fff", cellPx: 60, seed: 9 }));
    expect(a.length).toBeGreaterThan(0);
    expect(a).toBe(b);
  });

  it("虚影皮肤只有粉色影子:无描边、无纸纹,正常皮肤两样都有", () => {
    const ghost = pieceSkinSvg({ rows: 3, cols: 3, r: 1, c: 1, bg: "", cellPx: 64, seed: 2, ghost: true });
    expect(ghost).toContain("var(--pt-ghost)");
    expect(ghost).not.toContain("stroke");
    expect(ghost).not.toContain("linearGradient");
    const normal = pieceSkinSvg({ rows: 3, cols: 3, r: 1, c: 1, bg: "#FDF3C7", cellPx: 64, seed: 2 });
    expect(normal).toContain('stroke="var(--pt-piece-edge)"');
    expect(normal).toContain("linearGradient");
  });

  it("齿形只改裁剪层:吸附阈值与格心/最近格几何一个数不变(拖拽热区不动)", () => {
    // 与 1.2 的 snap.test.ts 同一组基准值:视觉层不碰这些函数
    const g: GridGeom = { left: 100, top: 200, cell: 60, gap: 8, rows: 4, cols: 4 };
    expect(snapThreshold(60)).toBeCloseTo(21, 5);
    expect(nearestCell(g, 130, 230)).toBe(0);
    const c = cellCenter(g, 10);
    expect(nearestCell(g, c.x, c.y)).toBe(10);
    expect(cellCenter(g, 0)).toEqual({ x: 130, y: 230 });
  });
});

describe("拼图乐园 · 1.3 视觉 · 反馈分支与 reduced", () => {
  it("放对 / 放错走不同视觉分支:回弹+白光 vs 摇头", () => {
    expect(dropFxClasses("snap", false)).toEqual(["pzv-snap", "pzv-seam"]);
    expect(dropFxClasses("wrong", false)).toEqual(["pzv-shake"]);
    expect(dropFxClasses("snap", false)).not.toContain("pzv-shake");
    expect(dropFxClasses("wrong", false)).not.toContain("pzv-seam");
  });

  it("reduced:抬升/回弹/摇头类名不加,接缝白光保留(功能反馈)", () => {
    expect(dropFxClasses("snap", true)).toEqual(["pzv-seam"]);
    expect(dropFxClasses("wrong", true)).toEqual([]);
    // 样式表里 reduced 块停掉回弹/摇头/星闪/装裱,但不碰 .pzv-seam
    const reducedBlock = PT_CSS.split("@media (prefers-reduced-motion: reduce)")[1]?.split("@media")[0] ?? "";
    expect(reducedBlock).toContain(".pzv-snap, .pzv-shake, .pzv-star { animation: none; }");
    expect(reducedBlock).toContain(".pzv-mbar");
    expect(reducedBlock).not.toContain(".pzv-seam");
  });

  it("虚影提示只读既有校验输出:输入冻结也不抛,校验数据不被写", () => {
    const holes = Object.freeze([2, 5, 7]) as unknown as number[];
    const filled = Object.freeze([5]) as unknown as number[];
    expect(ghostTarget(2, 2, holes, filled)).toBe(true); // 块对且空着
    expect(ghostTarget(5, 5, holes, filled)).toBe(false); // 已补过
    expect(ghostTarget(2, 7, holes, filled)).toBe(false); // 块不对
    expect(ghostTarget(3, 3, holes, filled)).toBe(false); // 不是缺口
    expect(holes).toEqual([2, 5, 7]);
    expect(filled).toEqual([5]);
  });

  it("三玩法专属视觉层都在:旋转把手 / 滑块凹槽 / 齿边皮肤", () => {
    expect(PT_CSS).toMatch(/\.pzv-knob \{/); // 旋转把手四点
    expect(PT_CSS).toMatch(/\.pz-tile\.pz-empty, \.pz-tile\.pz-gap \{[^}]*box-shadow: var\(--pt-slot\)/); // 凹槽
    expect(PT_CSS).toMatch(/\.pzv-skin \{/); // 齿边
    expect(PT_CSS).toMatch(/\.pzv-can \.pzv-skin \{[^}]*var\(--pt-glow\)/); // 可滑微光
    expect(PT_CSS).toMatch(/\.pzv-rotor \{[^}]*var\(--pt-rot-ms\)/); // 120ms 旋转过渡
    expect(PT_CSS).toMatch(/\.pzv-slidein \{ animation: pzvSlideIn var\(--pt-slide-ms\)/); // 90ms 滑动
  });

  it("旋转视角累计角:顺点 +90、撤销 -90,走散了就对齐真值", () => {
    expect(stepAngle(0, 0, 1)).toBe(90);
    expect(stepAngle(270, 3, 0)).toBe(360); // 3→0 顺转,不倒转三圈
    expect(stepAngle(360, 0, 3)).toBe(270); // 撤销倒着回
    expect(stepAngle(90, 1, 0)).toBe(0);
    expect(stepAngle(45, 2, 1)).toBe(90); // 视角和逻辑走散:直接对齐
  });
});

describe("拼图乐园 · 1.3 视觉 · 顶栏 / 装裱 / FX 清理", () => {
  it("顶栏三枚玩法图标签:当前玩法亮起,其余压暗", () => {
    const tag = modeTagHtml("rotate");
    expect((tag.match(/pzv-micon/g) ?? []).length).toBe(3);
    expect((tag.match(/pzv-mode-on/g) ?? []).length).toBe(1);
    expect(tag).toContain("本关玩法:旋转块");
    expect(modeTagHtml("fill")).toContain("本关玩法:缺块补齐");
    expect(modeTagHtml("slide")).toContain("本关玩法:推格子");
  });

  it("装裱浮层:四条木框边 + 画廊标牌 + 确定性彩纸(两次生成一个样)", () => {
    const html = framingOverlayHtml("第 3 幅作品装裱完成！");
    expect((html.match(/pzv-mbar/g) ?? []).length).toBe(4);
    expect(html).toContain("pzv-mt");
    expect(html).toContain("pzv-mb");
    expect(html).toContain("pzv-ml");
    expect(html).toContain("pzv-mr");
    expect(html).toContain("第 3 幅作品装裱完成！");
    expect(confettiHtml()).toBe(confettiHtml());
    expect((confettiHtml(12).match(/<i /g) ?? []).length).toBe(12);
  });

  it("destroy 后动画计时归零:clear 之后没有一个 setTimeout 还挂着", async () => {
    const fx = new PtFx();
    let fired = 0;
    fx.later(() => fired++, 5);
    fx.later(() => fired++, 5);
    fx.later(() => fired++, 1000);
    expect(fx.size).toBe(3);
    fx.clear();
    expect(fx.size).toBe(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(fired).toBe(0); // 清掉的计时不再触发
    // 正常走完的计时自己出账
    fx.later(() => fired++, 1);
    await new Promise((r) => setTimeout(r, 15));
    expect(fired).toBe(1);
    expect(fx.size).toBe(0);
  });

  it("360px 窄屏:顶栏一行放得下(nowrap 横滑),字号不缩水", () => {
    const narrow = PT_CSS.split("@media (max-width: 380px)")[1] ?? "";
    expect(narrow).toContain("flex-wrap: nowrap");
    expect(narrow).toContain("white-space: nowrap");
    // 徽章字号沿用 1.2 的 14px 规则,PT_CSS 不写更小的字号
    expect(PT_CSS).not.toMatch(/font-size: 1[0-3]px/);
  });
});
