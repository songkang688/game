/**
 * 识字小花园 · 1.3 视觉升级用例（第 25 步 A 档，只增不减）。
 *
 * 盯两件事：
 *  1. 新皮肤画得对：变宽笔迹映射、笔顺预演路径、呼吸点、五瓣花、花园映射、
 *     木卡类名分支、reduced 兜底、destroy 归零；
 *  2. 骨头一点没动：判定轨迹点集 / 容差 / 热区换算 / 拼字逻辑 / 笔顺数据
 *     全部换肤前后一致（教育正确性红线）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRUSH, brushWidths, strokeKindOf } from "../../art/kit/brush";
import { BLOOM_FRAMES, flowerSvg, FLOWER_TRIO } from "../../art/kit/flower";
import { checkStep, isRoundSolvable, stepFeedbackClass } from "./buildChar";
import {
  gardenCardLabel,
  gardenFlowers,
  gardenStage,
  guideDotAt,
  paperGridSvg,
  pointAlong,
  previewPath,
  WG_TOKENS,
} from "./inkArt";
import { buildCharTask } from "./levels";
import { BLOOM_MS, FALL_MS, MIN_PAD_PX, PREVIEW_MS, WGD_CSS } from "./tracing";
import {
  END_TOLERANCE,
  judgeTrace,
  PATH_TOLERANCE,
  STROKE_CHARS,
  strokesOf,
  traceTask,
  type Point,
} from "./strokes";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const tracing = readFileSync(`${DIR}tracing.ts`, "utf8");
const buildChar = readFileSync(`${DIR}buildChar.ts`, "utf8");

describe("视觉 · 毛笔变宽笔迹（渲染层）", () => {
  it("慢 / 中 / 快三速：慢粗快细，宽度全在 0.6-1.4 倍基准内", () => {
    const base = 7;
    const mk = (step: number): Point[] =>
      Array.from({ length: 6 }, (_, i) => [10 + i * step, 50] as const);
    // 同一条参考速度下比：中速轨迹里掺一段慢、一段快
    const mixed: Point[] = [[0, 50], [2, 50], [4, 50], [12, 50], [20, 50], [28, 50]];
    const w = brushWidths(mixed, base);
    expect(w[1]).toBeGreaterThan(w[4]); // 慢段(步长2) 比快段(步长8) 粗
    for (const speed of [2, 6, 14]) {
      for (const v of brushWidths(mk(speed), base)) {
        expect(v).toBeGreaterThanOrEqual(base * BRUSH.minScale);
        expect(v).toBeLessThanOrEqual(base * BRUSH.maxScale * BRUSH.startBoost);
      }
    }
  });

  it("判定轨迹点集换肤前后一字不差：freeze 住跑渲染计算，判定照样 right（钉死）", () => {
    const heng = strokesOf("一")!.strokes[0];
    const drawn: Point[] = heng.points.map(([x, y]) => [x, y] as const);
    for (const p of drawn) Object.freeze(p);
    Object.freeze(drawn);
    const before = JSON.stringify(drawn);
    brushWidths(drawn, 7, strokeKindOf("横"));
    expect(JSON.stringify(drawn)).toBe(before);
    expect(judgeTrace("一", 0, drawn).kind).toBe("right");
  });

  it("起笔顿点 ×1.2；收笔出锋按笔画类型分支：撇捺收尖到 0.4 倍、横竖圆头顿收", () => {
    const base = 7;
    // 撇捺类（拿「人」的撇当例子）
    const pie = strokesOf("人")!.strokes[0];
    expect(strokeKindOf(pie.name)).toBe("taper");
    const dense: Point[] = [[54, 14], [45, 32], [36, 50], [27, 68], [18, 86]];
    const wT = brushWidths(dense, base, "taper");
    expect(wT[0]).toBeCloseTo(base * BRUSH.startBoost);
    expect(wT[wT.length - 1]).toBeCloseTo(base * BRUSH.taperEnd);
    // 横竖类（拿「十」的横当例子）
    const heng = strokesOf("十")!.strokes[0];
    expect(strokeKindOf(heng.name)).toBe("blunt");
    const flat: Point[] = [[14, 50], [38, 50], [62, 50], [86, 50]];
    const wB = brushWidths(flat, base, "blunt");
    expect(wB[wB.length - 1]).toBeCloseTo(base);
  });

  it("已写笔画 inkDone 与当前笔画 inkActive 色值分明，两个都进了渲染层", () => {
    expect(WG_TOKENS.inkDone).toBe("#3a3a4a");
    expect(WG_TOKENS.inkActive).toBe("#ff8c42");
    expect(WG_TOKENS.inkDone).not.toBe(WG_TOKENS.inkActive);
    expect(tracing).toContain("WG_TOKENS.inkDone");
    expect(tracing).toContain("WG_TOKENS.inkActive");
  });
});

describe("视觉 · 笔顺引导（教育正确性红线）", () => {
  it("预演路径 = 笔顺数据路径：29 个字每一笔逐点相等，还是同一份数组", () => {
    for (const c of STROKE_CHARS) {
      for (const s of c.strokes) {
        const path = previewPath(s);
        expect(path).toBe(s.points);
        expect(path.length).toBe(s.points.length);
        s.points.forEach((p, i) => {
          expect(path[i][0]).toBe(p[0]);
          expect(path[i][1]).toBe(p[1]);
        });
      }
    }
  });

  it("呼吸点位置 = 当前笔画起点坐标（一 / 水 / 鸟 三字抽样逐笔断言）", () => {
    for (const char of ["一", "水", "鸟"]) {
      for (const s of strokesOf(char)!.strokes) {
        expect(guideDotAt(s)).toEqual(s.points[0]);
      }
    }
  });

  it("箭头沿路径取点：t=0 在起笔、t=1 在收笔，横的角度是 0°", () => {
    const heng = strokesOf("一")!.strokes[0];
    const a = pointAlong(heng.points, 0);
    const b = pointAlong(heng.points, 1);
    expect([a.x, a.y]).toEqual([...heng.points[0]]);
    expect([b.x, b.y]).toEqual([...heng.points[heng.points.length - 1]]);
    expect(a.angle).toBeCloseTo(0);
    // 竖折这种拐弯笔画，t=1 也要停在数据的收笔点上
    const zhe = strokesOf("山")!.strokes[1];
    const tail = pointAlong(zhe.points, 1);
    expect([tail.x, tail.y]).toEqual([...zhe.points[zhe.points.length - 1]]);
  });

  it("预演 600ms / 开花 450ms / 花落 400ms 三个时长与规格 4.3 对齐", () => {
    expect(PREVIEW_MS).toBe(600);
    expect(BLOOM_MS).toBe(450);
    expect(FALL_MS).toBe(400);
  });

  it("写错方向只灰抖不批评：oops 只是类名 + 300ms 收走，不打叉不扣分", () => {
    expect(tracing).toContain("wgd-ink wgd-ink-oops");
    expect(tracing).toMatch(/later\(\(\) => ink\.remove\(\), 300\)/);
    expect(WGD_CSS).toContain(".wgd-ink-oops line{stroke:#a7abb3;}");
    expect(WGD_CSS).toMatch(/wgdOops/);
    // 灰抖分支只数 retries、只念 traceHint 的鼓励话，绝不判失败
    const oops = tracing.slice(tracing.indexOf('verdict.kind !== "right"'), tracing.indexOf("ink?.remove()"));
    expect(oops).toContain("retries++");
    expect(oops).toContain("traceHint(verdict, c.char)");
    expect(oops).not.toContain("ctx.lose");
  });
});

describe("视觉 · 写字开花与花园横条", () => {
  it("写成字数 = 花园花朵数：0 / 3 / 全部 三点映射（超量也只到全部）", () => {
    const chars = traceTask(101, 3).chars;
    expect(gardenFlowers(chars, 0)).toHaveLength(0);
    expect(gardenFlowers(STROKE_CHARS.slice(0, 5), 3)).toHaveLength(3);
    expect(gardenFlowers(chars, chars.length)).toHaveLength(chars.length);
    expect(gardenFlowers(chars, chars.length + 9)).toHaveLength(chars.length);
  });

  it("花园三层繁茂：没写是空地、写了一半发芽、全写完花丛", () => {
    expect(gardenStage(0, 3)).toBe("soil");
    expect(gardenStage(1, 3)).toBe("sprout");
    expect(gardenStage(2, 3)).toBe("sprout");
    expect(gardenStage(3, 3)).toBe("meadow");
  });

  it("五帧展开 0.2/0.45/0.7/0.9/1.0，帧间画面互不相同（kit 契约在本款再钉一遍）", () => {
    expect([...BLOOM_FRAMES]).toEqual([0.2, 0.45, 0.7, 0.9, 1]);
    const frames = BLOOM_FRAMES.map((_, i) => flowerSvg({ cx: 50, cy: 24, r: 13, petal: FLOWER_TRIO[0], frame: i }));
    expect(new Set(frames).size).toBe(BLOOM_FRAMES.length);
  });

  it("同局相邻两朵花不撞色，三色都来自粉/黄/紫三元组", () => {
    const flowers = gardenFlowers(STROKE_CHARS.slice(0, 8), 8);
    for (let i = 1; i < flowers.length; i++) {
      expect(flowers[i].colorIndex).not.toBe(flowers[i - 1].colorIndex);
    }
    for (const f of flowers) {
      expect(f.colorIndex).toBeGreaterThanOrEqual(0);
      expect(f.colorIndex).toBeLessThan(FLOWER_TRIO.length);
    }
  });

  it("花园花朵点按弹出小字卡，文字 = 对应字原文 + 拼音（教育断言）", () => {
    expect(gardenCardLabel("水", "shuǐ")).toBe("水（shuǐ）");
    const chars = traceTask(104, 3).chars;
    const flowers = gardenFlowers(chars, chars.length);
    flowers.forEach((f, i) => {
      expect(f.char).toBe(chars[i].char);
      expect(f.pinyin).toBe(chars[i].pinyin);
      expect(gardenCardLabel(f.char, f.pinyin)).toContain(chars[i].char);
    });
    // 点按接线：data-char 原样进按钮、textContent 用同一个 label 函数
    expect(tracing).toContain('data-char="${f.char}"');
    expect(tracing).toContain("gardenCardEl.textContent = gardenCardLabel(char, pinyin)");
  });

  it("图层序从底到顶：宣纸格 → 模字 → 笔画 → 引导层 → 开花层，引导与开花不接指针", () => {
    const renderSrc = tracing.slice(tracing.indexOf("function render(): void"));
    const grid = renderSrc.indexOf("drawGrid()");
    const ghost = renderSrc.indexOf('class="wgd-ghost"');
    const guide = renderSrc.indexOf("guideLayerSvg(c)");
    const bloom = renderSrc.indexOf('class="wgd-bloomlayer"');
    expect(grid).toBeGreaterThan(-1);
    expect(ghost).toBeGreaterThan(grid);
    expect(guide).toBeGreaterThan(ghost);
    expect(bloom).toBeGreaterThan(guide);
    expect(WGD_CSS).toContain(".wgd-guide,.wgd-bloomlayer{pointer-events:none;}");
  });

  it("宣纸米字格：暖白渐变 + 红外框粗 2 + 米字虚线 1 + 三处纤维噪点", () => {
    const svg = paperGridSvg();
    expect(svg).toContain(WG_TOKENS.paperWarm);
    expect(svg.match(/wgd-fiber/g)).toHaveLength(3);
    expect(svg).toContain('class="wgd-grid-edge"');
    expect(svg.match(/wgd-grid-line/g)).toHaveLength(4);
    expect(WGD_CSS).toMatch(/\.wgd-grid-edge\{[^}]*stroke:#d94f4f;stroke-width:2/);
    expect(WGD_CSS).toMatch(/\.wgd-grid-line\{[^}]*stroke-width:1/);
    expect(WGD_CSS).toContain(WG_TOKENS.gridRedFaint.replace("rgba(", "rgba("));
  });
});

describe("视觉 · 组字工坊木质字卡", () => {
  it("拼对 / 拼错走不同视觉分支（类名断言），判定还是 checkStep 说了算", () => {
    expect(stepFeedbackClass(true)).toBe("bc-good");
    expect(stepFeedbackClass(false)).toBe("bc-bad");
    expect(stepFeedbackClass(true)).not.toBe(stepFeedbackClass(false));
    const round = buildCharTask(171).rounds[0];
    expect(checkStep(round, "radical", round.radical)).toBe(true);
    expect(checkStep(round, "part", round.part)).toBe(true);
    const wrongPick = round.radicalChoices.find((r) => r !== round.radical)!;
    expect(checkStep(round, "radical", wrongPick)).toBe(false);
  });

  it("拼合结果字形换肤前后一致：偏旁+部件→字的映射快照稳定、槽位仍写 round.char", () => {
    for (const lv of [171, 173]) {
      const a = buildCharTask(lv).rounds.map((r) => `${r.radical}+${r.part}=${r.char}`);
      const b = buildCharTask(lv).rounds.map((r) => `${r.radical}+${r.part}=${r.char}`);
      expect(a).toEqual(b);
      for (const r of buildCharTask(lv).rounds) expect(isRoundSolvable(r)).toBe(true);
    }
    expect(buildChar).toContain("slotC.textContent = round.char");
    expect(buildChar).toContain("slotR.textContent = round.radical");
    expect(buildChar).toContain("slotP.textContent = round.part");
  });

  it("木质字卡与磁吸金闪：木色 #d9a066、磁吸/金闪 260ms、弹回摇头 ±3° 320ms", () => {
    expect(buildChar).toContain(WG_TOKENS.woodCard);
    expect(buildChar).toMatch(/bcSnapR \.26s/);
    expect(buildChar).toMatch(/bcFlash \.26s/);
    expect(buildChar).toMatch(/bcShake \.32s/);
    expect(buildChar).toMatch(/rotate\(-3deg\)/);
    // 磁吸与金闪只是类名，换题时摘干净
    expect(buildChar).toContain('slotsEl.classList.add("bc-snap")');
    expect(buildChar).toContain('slotC.classList.add("bc-flash")');
    expect(buildChar).toContain('slotsEl.classList.remove("bc-snap")');
    expect(buildChar).toContain('slotC.classList.remove("bc-flash")');
  });
});

describe("视觉 · 热区 / 容差 / reduced / destroy 回归", () => {
  it("描红触控热区与判定容差换肤前后一致：容差 24/22、viewBox 与 padPoint 换算原样", () => {
    expect(END_TOLERANCE).toBe(24);
    expect(PATH_TOLERANCE).toBe(22);
    expect(MIN_PAD_PX).toBe(240);
    expect(tracing).toContain("viewBox=\"0 0 ${GRID} ${GRID}\"");
    expect(tracing).toContain("((ev.clientX - box.left) / w) * GRID");
    expect(tracing).toContain("((ev.clientY - box.top) / h) * GRID");
    expect(WGD_CSS).toContain(`min-width:${MIN_PAD_PX}px`);
    expect(WGD_CSS).toContain("touch-action:none");
    // 判定入口还是那一个：轨迹原样送 judgeTrace，不经过任何视觉函数
    expect(tracing).toContain("judgeTrace(c.char, done, drawn)");
  });

  it("reduced 下预演 / 展开帧 / 磁吸全停，静态引导与花朵结果仍在", () => {
    expect(WGD_CSS).toMatch(
      /prefers-reduced-motion:reduce\)\{\s*\.wgd-next,\.wgd-startdot,\.wgd-bloom,\.wgd-fall,\.wgd-ink-oops\{animation:none;\}/
    );
    // JS 侧：reduced 直接跳过 rAF 预演；开花一帧直达 + 瞬移落位
    expect(tracing).toMatch(/if \(reduced \|\| typeof requestAnimationFrame !== "function"\) return;/);
    expect(tracing).toMatch(/if \(reduced \|\| !layer\) \{/);
    // 静态箭头与呼吸点是渲染层常驻元素，reduced 只停动画不摘元素
    expect(tracing).toContain('class="wgd-startdot"');
    expect(tracing).toContain('class="wgd-arrowg"');
    expect(buildChar).toMatch(/prefers-reduced-motion:reduce\)\{\.bc-pick\.bc-good,\.bc-pick\.bc-bad/);
  });

  it("destroy 后预演 rAF 与开花计时器全部归零，花园监听也摘掉", () => {
    const body = tracing.slice(tracing.indexOf("destroy() {"));
    expect(body).toContain("cancelAnimationFrame(previewRaf)");
    expect(body).toContain("previewRaf = 0");
    expect(body).toContain("timeouts.forEach((t) => clearTimeout(t))");
    expect(body).toContain("timeouts.clear()");
    expect(body).toContain('gardenEl.removeEventListener("click", onGardenTap)');
  });

  it("360px 兜底：花园横条 ≤15vh 不挤书写区，字卡拼音字号 ≥16px，朗读按钮 ≥44px", () => {
    expect(WGD_CSS).toMatch(/\.wgd-garden\{[^}]*max-height:15vh/);
    const narrowPeek = WGD_CSS.match(/@media \(max-width:400px\)[\s\S]*?\.wgd-peek\{font-size:(\d+)px/);
    expect(Number(narrowPeek?.[1])).toBeGreaterThanOrEqual(16);
    expect(WGD_CSS).toMatch(/\.wgd-gardencard\{[^}]*font-size:16px/);
    expect(WGD_CSS).toMatch(/\.wgd-say\{[^}]*min-height:44px/);
  });
});
