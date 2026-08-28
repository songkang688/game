/**
 * 音乐星星 · 1.3 视觉升级守门用例（第 26 步 B 档，只增不减）。
 *
 * 钉死四类事：
 *  1. 彩虹与谱面位置都是**只读映射**——键色对彩虹、摆位对音高数据，一个都不许错位；
 *  2. 键位热区与判定窗口一个像素 / 一毫秒都没动（keyLayout / JUDGE_WINDOWS_MS 回归）；
 *  3. 特效全部不接指针、reduced 全停但静态发光仍在、destroy 之后计时器归零；
 *  4. 音程选项文本与录音片段数据结构零改动——琴键小卡与胶带条只是壳。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { starClipPolygon } from "../../art/kit/glowStar";
import { createFxLayer } from "./fx";
import { buildIntervals, LEVELS } from "./levels";
import { loadClips, SANDBOX_KEY, type SandboxClip } from "./sandbox";
import { createSandbox } from "./sandboxUi";
import {
  RAINBOW,
  clipWaveHeights,
  choiceStarGapPx,
  jellyKeyStyle,
  noteColorByMidi,
} from "./starTheme";
import { StarSynth } from "./synth";
import { JUDGE_WINDOWS_MS } from "./timing";
import { PENTATONIC_MIDI, PENTATONIC_NOTES, pitchOffsetPx } from "./tuning";
import { keyLayout } from "./runtime";
import { buildIntervalChoiceCard, createStarBoard, MST_CSS } from "./ui";
import {
  findAll,
  installDom,
  memoryStorage,
  StubAudioContext,
  StubEl,
  type InstalledDom,
} from "./domStub";

const dir = fileURLToPath(new URL(".", import.meta.url));
const indexSource = readFileSync(`${dir}index.ts`, "utf8");

/** 取一条 CSS 规则的声明体 */
function rule(selector: string, css = MST_CSS): string {
  const at = css.indexOf(selector + "{");
  if (at < 0) return "";
  return css.slice(at + selector.length + 1, css.indexOf("}", at));
}

/** reduced-motion 那一档的正文（剥掉注释） */
function reducedBlock(): string {
  const at = MST_CSS.indexOf("@media (prefers-reduced-motion:reduce)");
  expect(at, "没有 reduced 分支").toBeGreaterThan(-1);
  return MST_CSS.slice(at).replace(/\/\*[\s\S]*?\*\//g, "");
}

/** 临时把 matchMedia 桩成指定值 */
function withMatchMedia<T>(matches: boolean, fn: () => T): T {
  const g = globalThis as { matchMedia?: unknown };
  const had = "matchMedia" in g;
  const before = g.matchMedia;
  g.matchMedia = () => ({ matches });
  try {
    return fn();
  } finally {
    if (had) g.matchMedia = before;
    else delete g.matchMedia;
  }
}

let dom: InstalledDom;
beforeEach(() => {
  dom = installDom();
});
afterEach(() => {
  dom.restore();
  vi.useRealTimers();
});

function makeBoard(onDown: (i: number, id: number) => void = () => {}) {
  return createStarBoard({
    midis: PENTATONIC_MIDI,
    notes: PENTATONIC_NOTES,
    width: 360,
    onDown,
  });
}

describe("音乐星星 1.3 · 键盘彩虹与谱面位置（只读映射钉死）", () => {
  it("键盘颜色与音阶彩虹一致：键序遍历，颜色 + 位置双通道", () => {
    const b = makeBoard();
    // 五声五键落在彩虹的 0/1/2/4/5 级（do re mi sol la）
    const expected = [RAINBOW[0], RAINBOW[1], RAINBOW[2], RAINBOW[4], RAINBOW[5]];
    b.buttons.forEach((btn, i) => {
      const color = noteColorByMidi(PENTATONIC_MIDI[i]);
      expect(color, `第 ${i} 键的彩虹色错位`).toBe(expected[i]);
      // 颜色通道：果冻键渐变按这颗音的彩虹色内联
      expect(btn.style.background).toBe(jellyKeyStyle(color).background);
      // 星形 SVG 的填充也是同一颗彩虹色
      expect((btn as unknown as StubEl).innerHTML).toContain(`fill="${color}"`);
    });
    // 位置通道：音越高摆得越上（marginBottom 单调增）
    const offsets = b.buttons.map((btn) => Number.parseInt(btn.style.marginBottom || "0", 10));
    for (let i = 1; i < offsets.length; i++) expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
    b.destroy();
  });

  it("音符星星的谱面位置 = 音高数据位置（五个音逐一断言，乐理钉死）", () => {
    const b = makeBoard();
    // 五键的纵向摆位必须严格等于 pitchOffsetPx 按音高数据算出的值
    b.buttons.forEach((btn, i) => {
      const want = pitchOffsetPx(PENTATONIC_MIDI[i], 60, 69, 60);
      expect(btn.style.marginBottom, `第 ${i} 键的谱面位置偏离音高数据`).toBe(`${want}px`);
    });
    // 音高数据本身在渲染前后一个字不变
    expect(PENTATONIC_MIDI).toEqual([60, 62, 64, 67, 69]);
    b.destroy();
  });
});

describe("音乐星星 1.3 · 键按下的视觉分支与热区回归", () => {
  it("按下走下沉 + 发光分支，热区（键宽高）与判定窗口一个都没动", () => {
    const hits: number[] = [];
    const b = makeBoard((i) => hits.push(i));
    const btn = b.buttons[0] as unknown as StubEl;
    const widthBefore = b.buttons[0].style.width;
    const heightBefore = b.buttons[0].style.minHeight;
    btn.fire("pointerdown", { pointerId: 1 });
    expect(btn.classList.contains("mst-down")).toBe(true);
    expect(btn.classList.contains("mst-lit")).toBe(true);
    expect(hits).toEqual([0]);
    // 热区零改动：按下前后键的宽高内联值一字不差
    expect(b.buttons[0].style.width).toBe(widthBefore);
    expect(b.buttons[0].style.minHeight).toBe(heightBefore);
    btn.fire("pointerup", { pointerId: 1 });
    expect(btn.classList.contains("mst-down")).toBe(false);
    // 布局与判定窗口回归：keyLayout 与三档窗口的数一个不变
    expect(keyLayout(360, 5)).toEqual({ width: 65, gap: 8 });
    expect(JUDGE_WINDOWS_MS).toEqual([60, 120, 200]);
    // 下沉量是 3px 且只走 transform（不动盒子）
    expect(rule(".mst-star.mst-down")).toContain("transform:translateY(3px)");
    b.destroy();
  });

  it("按下升起一颗小音符星，400ms 后清掉；destroy 时计时一起清", () => {
    vi.useFakeTimers();
    const b = makeBoard();
    const btn = b.buttons[2] as unknown as StubEl;
    btn.fire("pointerdown", { pointerId: 1 });
    const rise = findAll(btn, "mst-rise");
    expect(rise).toHaveLength(1);
    expect(rise[0].innerHTML).toContain("<svg");
    expect(rise[0].style.color).toBe(noteColorByMidi(PENTATONIC_MIDI[2]));
    vi.advanceTimersByTime(450);
    expect(findAll(btn, "mst-rise")).toHaveLength(0);
    // 再按一次然后立刻 destroy：不许留下会炸的计时器
    btn.fire("pointerdown", { pointerId: 2 });
    b.destroy();
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });

  it("reduced 下按键不升音符星，只保留键顶发光（果冻与彩虹照旧）", () => {
    withMatchMedia(true, () => {
      const b = makeBoard();
      const btn = b.buttons[0] as unknown as StubEl;
      btn.fire("pointerdown", { pointerId: 1 });
      expect(findAll(btn, "mst-rise")).toHaveLength(0);
      // 发光分支还在：mst-down / mst-lit 照加，果冻背景照内联
      expect(btn.classList.contains("mst-down")).toBe(true);
      expect(b.buttons[0].style.background).toContain("linear-gradient");
      b.destroy();
    });
  });
});

describe("音乐星星 1.3 · 命中与 miss 的视觉分支互斥", () => {
  it("命中走音波环 + 档位色，miss 只走眨眼——两条路径的类名不交叉", () => {
    // 弹对分支：fx.ringAt 就在 inputPos++ 旁边，绝不加眨眼类
    const correctAt = indexSource.indexOf("if (i === seq[inputPos]) {\n      fx.ringAt");
    expect(correctAt, "弹对分支没接音波环").toBeGreaterThan(-1);
    // miss 分支：onMiss 里只加 mst-dot-blink，不放环
    const missBody = indexSource.slice(
      indexSource.indexOf("function onMiss()"),
      indexSource.indexOf("function onStarDown")
    );
    expect(missBody).toContain('classList.add("mst-dot-blink")');
    expect(missBody).not.toContain("ringAt");
    // 类名层面：命中三档与 miss 的四个类颜色各自独立定义、互不相同
    const grades = [".mst-dot-perfect", ".mst-dot-good", ".mst-dot-ok", ".mst-dot-miss"];
    const bodies = grades.map((g) => rule(g));
    for (const b of bodies) expect(b).toContain("background:");
    expect(new Set(bodies).size).toBe(grades.length);
    // 眨眼只缩 0.9 回弹（不批评），不碰命中的档位色
    expect(rule(".mst-dot-blink")).toContain("mst-dot-blink 260ms");
    expect(MST_CSS).toContain("@keyframes mst-dot-blink{0%{transform:scale(1)}45%{transform:scale(.9)}");
  });
});

describe("音乐星星 1.3 · 特效层与 reduced 红线", () => {
  it("音波环两圈：同心圆错峰 80ms，扩散完自动清；特效层不接指针", () => {
    vi.useFakeTimers();
    const fx = createFxLayer({});
    expect(fx.el.className).toBe("mst-fx");
    expect(rule(".mst-fx")).toContain("pointer-events:none");
    fx.ringAt(50, 60);
    const rings = findAll(fx.el as unknown as StubEl, "mst-ring");
    expect(rings).toHaveLength(2);
    expect(rings[0].style.animationDelay).toBe("0ms");
    expect(rings[1].style.animationDelay).toBe("80ms");
    expect(fx.pendingTimers).toBe(1);
    vi.advanceTimersByTime(400);
    expect(findAll(fx.el as unknown as StubEl, "mst-ring")).toHaveLength(0);
    expect(fx.pendingTimers).toBe(0);
    fx.destroy();
  });

  it("连击流星一条 800ms 自动清；星空渐亮是可逆的类开关", () => {
    vi.useFakeTimers();
    const fx = createFxLayer({});
    fx.meteor();
    expect(findAll(fx.el as unknown as StubEl, "mst-meteor")).toHaveLength(1);
    fx.brighten(true);
    expect((fx.el as unknown as StubEl).classList.contains("mst-fx-bright")).toBe(true);
    fx.brighten(false);
    expect((fx.el as unknown as StubEl).classList.contains("mst-fx-bright")).toBe(false);
    vi.advanceTimersByTime(900);
    expect(findAll(fx.el as unknown as StubEl, "mst-meteor")).toHaveLength(0);
    fx.destroy();
  });

  it("reduced：音波环 / 流星 / 脉动全为 0，静态发光仍在", () => {
    const fx = createFxLayer({ reduced: true });
    fx.ringAt(50, 50);
    fx.meteor();
    expect((fx.el as unknown as StubEl).children).toHaveLength(0);
    expect(fx.pendingTimers).toBe(0);
    // 渐亮保留为静态（结算点亮在 reduced 下仍可见）
    fx.brighten(true);
    expect((fx.el as unknown as StubEl).classList.contains("mst-fx-bright")).toBe(true);
    fx.destroy();
    // CSS 侧：reduced 档脉动 / 眨眼 / 环 / 流星 / 星座逐段全停
    const block = reducedBlock();
    expect(block).toContain(".mst-ring,.mst-meteor{display:none;}");
    expect(rule(".mst-dot-cur", block)).toContain("animation:none");
    expect(rule(".mst-dot-blink", block)).toContain("animation:none");
    expect(rule(".mst-lines-seg", block)).toContain("animation:none");
    // 静态发光仍在：reduced 的当前拍常亮加描边，基础星形 drop-shadow 不在禁停之列
    expect(rule(".mst-dot-cur", block)).toContain("drop-shadow");
    expect(rule("\n.mst-dot")).toContain("drop-shadow");
  });

  it("destroy 之后音波环与流星的计时器归零、特效层从 DOM 摘除", () => {
    vi.useFakeTimers();
    const host = dom.doc.createElement("div");
    const fx = createFxLayer({});
    host.appendChild(fx.el as unknown as StubEl);
    fx.ringAt(30, 30);
    fx.meteor();
    expect(fx.pendingTimers).toBeGreaterThan(0);
    fx.destroy();
    expect(fx.pendingTimers).toBe(0);
    expect(host.children).toHaveLength(0);
    // destroy 之后再触发一律无事发生
    fx.ringAt(50, 50);
    fx.meteor();
    expect(fx.pendingTimers).toBe(0);
  });

  it("装饰层全部不接指针：光晕 / 升星 / 波形 / 音程示意 / 星座 SVG", () => {
    for (const sel of [".mst-halo", ".mst-rise", ".mst-clip-wave", ".mst-choice-stars", ".mst-lines"]) {
      expect(rule(sel), `${sel} 缺 pointer-events:none`).toContain("pointer-events:none");
    }
    // 星空舞台走 ::before 伪元素，DOM 零节点、天生不接指针
    expect(rule(".mst-sky::before")).toContain("pointer-events:none");
  });
});

describe("音乐星星 1.3 · 星空五线谱与结算星座", () => {
  it("夜空舞台与简谱区都垫上星轨 SVG（程序化 data-URI，无位图）", () => {
    const sky = rule(".mst-sky::before");
    expect(sky).toContain("#1d2b53");
    expect(sky).toContain("data:image/svg+xml");
    const score = rule("\n.mst-score");
    expect(score).toContain("data:image/svg+xml");
    expect(score).toContain("#1d2b53");
    expect(MST_CSS).not.toContain("base64");
  });

  it("结算星座连线逐段点亮：段类名 + pathLength + 错峰延迟；reduced 一次性全亮", () => {
    const b = makeBoard();
    b.drawConstellation([0, 2, 4, 1]);
    const svg = (b.el as unknown as StubEl).children[0];
    expect(svg.children).toHaveLength(3);
    svg.children.forEach((line, k) => {
      expect(line.classList.contains("mst-lines-seg")).toBe(true);
      expect(line.getAttribute("pathLength")).toBe("1");
      expect(line.style.animationDelay).toBe(`${k * 160}ms`);
    });
    b.clearConstellation();
    expect(svg.children).toHaveLength(0);
    expect(rule(".mst-lines-seg", reducedBlock())).toContain("stroke-dashoffset:0");
    b.destroy();
  });
});

describe("音乐星星 1.3 · 音程琴键小卡（题目数据钉死）", () => {
  it("选项文本与题目数据一致：小卡的 label 一字不差，题目结构零改动", () => {
    const lv = LEVELS.findIndex((l) => l.mode === "interval");
    expect(lv).toBeGreaterThan(0);
    const before = JSON.stringify(buildIntervals(lv));
    const q = buildIntervals(lv)[0];
    for (const label of q.choices) {
      const btn = dom.doc.createElement("button");
      buildIntervalChoiceCard(btn as unknown as HTMLElement, label);
      const text = findAll(btn, "mst-choice-label");
      expect(text).toHaveLength(1);
      expect(text[0].textContent).toBe(label);
    }
    // 建卡前后题目数据一个字不变（确定性生成 + 只读映射）
    expect(JSON.stringify(buildIntervals(lv))).toBe(before);
    expect(q.choices[q.correct]).toMatch(/^(往上|往下) \d 格$/);
  });

  it("上下两星的距离随音程格数单调增（三例），方向对得上", () => {
    const gapOf = (label: string): { gap: number; dir: number } => {
      const btn = dom.doc.createElement("button");
      buildIntervalChoiceCard(btn as unknown as HTMLElement, label);
      const stars = findAll(btn, "mst-choice-star");
      expect(stars).toHaveLength(2);
      const tops = stars.map((s) => Number.parseFloat(s.style.top));
      return { gap: Math.abs(tops[0] - tops[1]), dir: Math.sign(tops[0] - tops[1]) };
    };
    const g1 = gapOf("往上 1 格");
    const g2 = gapOf("往上 2 格");
    const g4 = gapOf("往下 4 格");
    expect(g2.gap).toBeGreaterThan(g1.gap);
    expect(g4.gap).toBeGreaterThan(g2.gap);
    expect(g1.gap).toBe(choiceStarGapPx(1));
    expect(g4.gap).toBe(choiceStarGapPx(4));
    // 往上：先弹的（左）在下、后弹的（右）在上；往下反过来
    expect(g1.dir).toBe(1);
    expect(gapOf("往下 2 格").dir).toBe(-1);
    // 360px 红线：卡高 ≥44、字号 ≥14
    expect(rule(".mst-choice-stars")).toContain("height:44px");
    expect(rule("\n.mst-choice")).toContain("min-height:56px");
    expect(rule(".mst-choice-label")).toContain("font-size:16px");
  });
});

describe("音乐星星 1.3 · 录音胶带条只是壳", () => {
  it("renderClips 前后片段数据结构不变，波形从音符只读推导", () => {
    const clip: SandboxClip = {
      id: "a",
      name: "第 1 段",
      scale: "penta",
      notes: [
        { at: 0, key: 0, dur: 300 },
        { at: 400, key: 2, dur: 800 },
      ],
      ms: 1200,
    };
    const seeded = JSON.stringify([clip]);
    const store = memoryStorage({ [SANDBOX_KEY]: seeded });
    const synth = new StarSynth({ makeContext: () => new StubAudioContext(), storage: null });
    const sb = createSandbox({ synth, storage: store, now: () => 0 });

    const rows = findAll(sb.el as unknown as StubEl, "mst-clip");
    expect(rows).toHaveLength(1);
    // 波形条与 clipWaveHeights 的只读推导逐根一致
    const bars = findAll(rows[0], "mst-clip-bar");
    const heights = clipWaveHeights(clip.notes);
    expect(bars).toHaveLength(heights.length);
    bars.forEach((bar, i) => expect(bar.style.height).toBe(`${heights[i]}px`));
    // 播放钮文本原样（▶️ + 名字），行为按钮一颗不少
    const play = findAll(rows[0], "mst-clip-play");
    expect(play).toHaveLength(1);
    expect(play[0].textContent).toBe("▶️ 第 1 段");
    // 存档与数据结构零改动：渲染前后同一串 JSON
    expect(store.data.get(SANDBOX_KEY)).toBe(seeded);
    expect(loadClips(store)).toEqual([clip]);

    sb.destroy();
    synth.destroy();
  });
});
