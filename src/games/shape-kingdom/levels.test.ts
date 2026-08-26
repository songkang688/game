import { describe, expect, it } from "vitest";
import { totalSize } from "../level99";
import { COLOR_NAMES, SHAPE_NAMES, SHAPE_SIDES, type ShapeColor, type ShapeKind } from "./logic";
import { buildQuestions, CHAPTERS, kindPool, LEVELS, questionCount, shapeSVG } from "./levels";

describe("形状王国 188 关", () => {
  it("恰好 188 关", () => {
    expect(LEVELS).toHaveLength(188);
  });

  it("至少 6 个主题章节，章节大小之和为 188", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("每关题目合法：3 个唯一选项、正确项与答案一致", () => {
    for (let i = 0; i < 99; i++) {
      const qs = buildQuestions(i);
      expect(qs.length).toBe(questionCount(i));
      for (const q of qs) {
        expect(q.choices.length).toBe(3);
        expect(new Set(q.choices).size).toBe(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(3);
        expect(q.choices[q.correct]).toContain(q.answer);
      }
    }
  });

  it("数数题的答案与图里的目标形状数量一致", () => {
    const nameToKind = new Map<string, ShapeKind>(
      (Object.entries(SHAPE_NAMES) as Array<[ShapeKind, string]>).map(([k, n]) => [n, k])
    );
    let seen = 0;
    for (let i = 67; i < 99; i++) {
      for (const q of buildQuestions(i)) {
        if (q.kind !== "countshape") continue;
        seen++;
        const m = q.ask.match(/几个(.+)？/);
        expect(m).not.toBeNull();
        const target = nameToKind.get(m![1]);
        expect(target).toBeDefined();
        const hits = q.promptHTML.match(new RegExp(`data-kind="${target}"`, "g")) ?? [];
        expect(String(hits.length)).toBe(q.answer);
      }
    }
    expect(seen).toBeGreaterThan(10);
  });

  it("抽 20+ 题机器校验：形状/颜色/大小/数边判定正确、引导语口语化（≤15 个汉字）", () => {
    const nameToKind = new Map<string, ShapeKind>(
      (Object.entries(SHAPE_NAMES) as Array<[ShapeKind, string]>).map(([k, n]) => [n, k])
    );
    const nameToColor = new Map<string, ShapeColor>(
      (Object.entries(COLOR_NAMES) as Array<[ShapeColor, string]>).map(([k, n]) => [n, k])
    );
    const qs = [0, 24, 49, 74, 98].flatMap((i) => buildQuestions(i));
    expect(qs.length).toBeGreaterThanOrEqual(20);
    for (const q of qs) {
      expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(15);
      if (q.kind === "shape") {
        const m = q.promptHTML.match(/data-kind="([a-z]+)"/);
        expect(m).not.toBeNull();
        expect(SHAPE_NAMES[m![1] as ShapeKind]).toBe(q.answer);
        expect(q.choices[q.correct]).toBe(q.answer);
      } else if (q.kind === "findshape") {
        const name = q.ask.match(/「(.+)」/)![1];
        expect(q.choices[q.correct]).toContain(`data-kind="${nameToKind.get(name)}"`);
      } else if (q.kind === "color") {
        const m = q.promptHTML.match(/data-color="([a-z]+)"/);
        expect(m).not.toBeNull();
        expect(COLOR_NAMES[m![1] as ShapeColor]).toBe(q.answer);
        expect(q.choices[q.correct]).toBe(q.answer);
      } else if (q.kind === "findcolor") {
        const name = q.ask.match(/哪个是(.+)的？/)![1];
        expect(q.choices[q.correct]).toContain(`data-color="${nameToColor.get(name)}"`);
      } else if (q.kind === "size") {
        const sizes = q.choices.map((c) => Number(c.match(/width="(\d+)"/)![1]));
        const goal = q.ask.includes("最大") ? Math.max(...sizes) : Math.min(...sizes);
        expect(sizes[q.correct]).toBe(goal);
      } else if (q.kind === "sides") {
        const m = q.promptHTML.match(/data-kind="([a-z]+)"/);
        expect(m).not.toBeNull();
        expect(String(SHAPE_SIDES[m![1] as ShapeKind])).toBe(q.answer);
        expect(q.choices[q.correct]).toBe(q.answer);
      } else {
        const name = q.ask.match(/几个(.+)？/)![1];
        const hits = q.promptHTML.match(new RegExp(`data-kind="${nameToKind.get(name)}"`, "g")) ?? [];
        expect(String(hits.length)).toBe(q.answer);
      }
    }
  });

  it("同一关重试题目一致（确定性生成）", () => {
    for (const i of [0, 20, 45, 70, 98]) {
      expect(JSON.stringify(buildQuestions(i))).toBe(JSON.stringify(buildQuestions(i)));
    }
  });

  it("六区题型各有侧重（并非同一模板）", () => {
    const signatures = new Set(
      [2, 19, 36, 52, 68, 85].map((i) => kindPool(i).slice().sort().join(","))
    );
    expect(signatures.size).toBeGreaterThanOrEqual(6);
    expect(kindPool(2)).toContain("shape");
    expect(kindPool(19)).toContain("color");
    expect(kindPool(40)).toContain("size");
    expect(kindPool(55)).toContain("sides");
    expect(kindPool(70)).toContain("countshape");
  });

  it("shapeSVG 八种形状都能生成", () => {
    for (const k of ["circle", "triangle", "square", "rectangle", "star", "heart", "diamond", "pentagon"] as const) {
      const svg = shapeSVG(k, "red", 80);
      expect(svg).toContain(`data-kind="${k}"`);
      expect(svg).toContain("<svg");
    }
  });

  it("章节内题量递进", () => {
    expect(questionCount(0)).toBeLessThan(questionCount(16));
    expect(questionCount(83)).toBeLessThanOrEqual(questionCount(98));
  });
});

// ---------------------------------------------------------------------------
// 1.1：第 100–188 关（周长面积镇 / 对称旋转塔 / 立体展开馆 / 坐标方位岛）
// ---------------------------------------------------------------------------

/** 1.0 的前 99 关章节切分，硬编码做回归断言 */
const LEGACY_CHAPTER_SNAPSHOT = [
  { name: "形状城门", size: 17 },
  { name: "彩虹染坊", size: 17 },
  { name: "大小滑梯", size: 17 },
  { name: "数边小桥", size: 16 },
  { name: "数数广场", size: 16 },
  { name: "国王大赛", size: 16 },
];

const NEW_FROM = 99;
const NEW_LEVELS = Array.from({ length: 188 - NEW_FROM }, (_, i) => NEW_FROM + i);
const ADVANCED_KINDS = new Set([
  "perimeter", "area", "symmetry", "mirror", "rotate", "solid", "net", "coord", "path",
]);

function attr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function numAttr(html: string, name: string): number {
  const v = attr(html, name);
  expect(v, `缺少属性 ${name}`).not.toBeNull();
  return Number(v);
}

function rotateKeyCW(key: string, size: number): string {
  const out: string[] = new Array(key.length).fill("0");
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      out[r * size + c] = key[(size - 1 - c) * size + r];
    }
  }
  return out.join("");
}

function mirrorKey(key: string, size: number): string {
  const out: string[] = new Array(key.length).fill("0");
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      out[r * size + c] = key[r * size + (size - 1 - c)];
    }
  }
  return out.join("");
}

const AXES: Record<string, number> = {
  triangle: 1, square: 4, rectangle: 2, star: 5, heart: 1, diamond: 2, pentagon: 5,
};
const FACES: Record<string, number> = {
  cube: 6, cuboid: 6, triPrism: 5, squarePyramid: 5, triPyramid: 4, cylinder: 3, cone: 2, sphere: 1,
};
const EDGES: Record<string, number> = { cube: 12, cuboid: 12, triPrism: 9, squarePyramid: 8, triPyramid: 6 };
const VERTICES: Record<string, number> = { cube: 8, cuboid: 8, triPrism: 6, squarePyramid: 5, triPyramid: 4 };
const NETS: Record<string, string> = {
  cube: "6 个一样大的正方形",
  cuboid: "6 个长方形，对面两两相同",
  triPrism: "2 个三角形 ＋ 3 个长方形",
  squarePyramid: "1 个正方形 ＋ 4 个三角形",
  triPyramid: "4 个一样的三角形",
  cylinder: "2 个圆 ＋ 1 个长方形",
  cone: "1 个圆 ＋ 1 个扇形",
  sphere: "球面展不平，没有平面展开图",
};

/** 逐题机器验算：从题面的 data 属性重新算一遍答案，对不上就是这一关不可解 */
function verify(q: ReturnType<typeof buildQuestions>[number], where: string): void {
  const html = q.promptHTML;
  switch (q.kind) {
    case "perimeter": {
      const fig = attr(html, "data-fig");
      const w = numAttr(html, "data-w");
      const h = numAttr(html, "data-h");
      expect(["rect", "ell"], where).toContain(fig);
      // 缺一个角不改变周长：多出来的两条边正好补上被切掉的两条
      expect(q.answer, where).toBe(`${2 * (w + h)} 厘米`);
      break;
    }
    case "area": {
      const fig = attr(html, "data-fig");
      if (fig === "rect") {
        expect(q.answer, where).toBe(`${numAttr(html, "data-w") * numAttr(html, "data-h")} 平方厘米`);
      } else if (fig === "tri") {
        const v = (numAttr(html, "data-b") * numAttr(html, "data-h")) / 2;
        expect(Number.isInteger(v), `${where}：三角形面积应是整数`).toBe(true);
        expect(q.answer, where).toBe(`${v} 平方厘米`);
      } else {
        const v = numAttr(html, "data-w") * numAttr(html, "data-h") - numAttr(html, "data-cw") * numAttr(html, "data-ch");
        expect(v, where).toBeGreaterThan(0);
        expect(q.answer, where).toBe(`${v} 平方厘米`);
      }
      break;
    }
    case "symmetry": {
      const kind = attr(html, "data-kind")!;
      expect(AXES[kind], `${where}：${kind} 没有确定的对称轴条数`).toBeDefined();
      expect(q.answer, where).toBe(`${AXES[kind]} 条`);
      break;
    }
    case "mirror": {
      const key = attr(html, "data-cells")!;
      const size = numAttr(html, "data-size");
      expect(q.answer, where).toBe(`data-cells="${mirrorKey(key, size)}"`);
      expect(q.choices[q.correct], where).toContain(q.answer);
      break;
    }
    case "rotate": {
      const key = attr(html, "data-cells")!;
      const size = numAttr(html, "data-size");
      const deg = Number(q.ask.match(/转 (\d+) 度/)![1]);
      let want = key;
      for (let i = 0; i < deg / 90; i++) want = rotateKeyCW(want, size);
      expect(q.answer, where).toBe(`data-cells="${want}"`);
      expect(q.choices[q.correct], where).toContain(q.answer);
      break;
    }
    case "solid": {
      const kind = attr(html, "data-solid")!;
      const table = q.ask.includes("面") ? FACES : q.ask.includes("棱") ? EDGES : VERTICES;
      const unit = q.ask.includes("棱") ? "条" : "个";
      expect(table[kind], `${where}：${kind} 不该被问这个`).toBeDefined();
      expect(q.answer, where).toBe(`${table[kind]} ${unit}`);
      break;
    }
    case "net": {
      const kind = attr(html, "data-solid")!;
      expect(q.answer, where).toBe(NETS[kind]);
      expect(q.choices[q.correct], where).toContain(q.answer);
      break;
    }
    case "coord": {
      const grid = attr(html, "data-grid")!;
      const items = grid.split("|").map((s) => {
        const [x, y, kind] = s.split(",");
        return { x: Number(x), y: Number(y), kind };
      });
      expect(new Set(items.map((i) => `${i.x},${i.y}`)).size, where).toBe(items.length);
      const byPoint = q.ask.match(/^\((\d+), (\d+)\) 上是什么形状？$/);
      if (byPoint) {
        const hit = items.find((i) => i.x === Number(byPoint[1]) && i.y === Number(byPoint[2]));
        expect(hit, where).toBeDefined();
        expect(q.answer, where).toBe(SHAPE_NAMES[hit!.kind as ShapeKind]);
      } else {
        const name = q.ask.match(/^(.+)在哪个位置？$/)![1];
        const hit = items.find((i) => SHAPE_NAMES[i.kind as ShapeKind] === name);
        expect(hit, where).toBeDefined();
        expect(q.answer, where).toBe(`(${hit!.x}, ${hit!.y})`);
      }
      break;
    }
    case "path": {
      const start = attr(html, "data-start")!.split(",").map(Number);
      const moves = attr(html, "data-moves")!.split("|");
      let x = start[0];
      let y = start[1];
      for (const mv of moves) {
        const m = mv.match(/^(右|左|上|下)(\d+)$/)!;
        const n = Number(m[2]);
        if (m[1] === "右") x += n;
        else if (m[1] === "左") x -= n;
        else if (m[1] === "上") y += n;
        else y -= n;
        expect(x >= 1 && x <= 6 && y >= 1 && y <= 6, `${where}：走出格子了`).toBe(true);
      }
      expect(moves.length, where).toBeGreaterThanOrEqual(2);
      expect(q.answer, where).toBe(`(${x}, ${y})`);
      break;
    }
    default:
      throw new Error(`${where}：第 100–188 关不该出现旧题型 ${q.kind}`);
  }
}

describe("形状王国 · 1.1 第 100–188 关", () => {
  it("前 99 关章节切分与 1.0 完全一致（回归）", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => ({ name: c.name, size: c.size }))).toEqual(LEGACY_CHAPTER_SNAPSHOT);
    expect(CHAPTERS.slice(0, 6).reduce((s, c) => s + c.size, 0)).toBe(99);
  });

  it("末尾追加 4 个全新章节共 89 关，总数正好 188", () => {
    const extra = CHAPTERS.slice(6);
    expect(extra).toHaveLength(4);
    expect(extra.reduce((s, c) => s + c.size, 0)).toBe(89);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });

  it("新章节都配齐了 emoji、粉彩色和一句话介绍", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("前 99 关的题量与题型池不受扩容影响（按 1.0 公式回归）", () => {
    const legacySizes = [17, 17, 17, 16, 16, 16];
    let start = 0;
    legacySizes.forEach((size) => {
      for (let i = 0; i < size; i++) {
        const level = start + i;
        const t = i / Math.max(1, size - 1);
        expect(questionCount(level)).toBe(4 + Math.min(3, Math.floor(t * 3.6)));
        for (const k of kindPool(level)) {
          expect(ADVANCED_KINDS.has(k), `第 ${level + 1} 关不该出现新题型 ${k}`).toBe(false);
        }
      }
      start += size;
    });
    expect(start).toBe(99);
  });

  it("第 100–188 关逐关合法：题量 6–10、3 个唯一选项、正确项与答案一致", () => {
    for (const level of NEW_LEVELS) {
      const qs = buildQuestions(level);
      expect(qs.length, `第 ${level + 1} 关`).toBe(questionCount(level));
      expect(qs.length).toBeGreaterThanOrEqual(6);
      expect(qs.length).toBeLessThanOrEqual(10);
      for (const q of qs) {
        expect(q.choices.length, `第 ${level + 1} 关`).toBe(3);
        expect(new Set(q.choices).size, `第 ${level + 1} 关`).toBe(3);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(3);
        expect(q.choices[q.correct], `第 ${level + 1} 关 ${q.kind}`).toContain(q.answer);
        expect(ADVANCED_KINDS.has(q.kind)).toBe(true);
      }
    }
  });

  it("第 100–188 关逐关可解：每道题都能从图上的数据重新算出答案", () => {
    let checked = 0;
    for (const level of NEW_LEVELS) {
      for (const q of buildQuestions(level)) {
        verify(q, `第 ${level + 1} 关 · ${q.kind}`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(600);
  });

  it("周长面积镇：长方形 / 直角三角形 / 缺角图形都出现过", () => {
    const figs = new Set<string>();
    for (let level = 99; level < 122; level++) {
      for (const q of buildQuestions(level)) figs.add(attr(q.promptHTML, "data-fig") ?? "");
    }
    expect(figs.has("rect")).toBe(true);
    expect(figs.has("tri")).toBe(true);
    expect(figs.has("ell")).toBe(true);
  });

  it("周长和面积的单位不会混：周长论厘米，面积论平方厘米", () => {
    for (let level = 99; level < 122; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind === "perimeter") expect(q.answer).toMatch(/^\d+ 厘米$/);
        if (q.kind === "area") expect(q.answer).toMatch(/^\d+ 平方厘米$/);
      }
    }
  });

  it("对称旋转塔：数对称轴 / 照镜子 / 转方向都覆盖到了", () => {
    const kinds = new Set<string>();
    for (let level = 122; level < 144; level++) {
      for (const q of buildQuestions(level)) kinds.add(q.kind);
    }
    expect(kinds.has("symmetry")).toBe(true);
    expect(kinds.has("mirror")).toBe(true);
    expect(kinds.has("rotate")).toBe(true);
  });

  it("镜像 / 旋转题的三个选项互不相同，不会出现两个正确答案", () => {
    let seen = 0;
    for (let level = 122; level < 144; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "mirror" && q.kind !== "rotate") continue;
        seen++;
        const keys = q.choices.map((c) => attr(c, "data-cells"));
        expect(new Set(keys).size).toBe(3);
        expect(keys.filter((k) => `data-cells="${k}"` === q.answer)).toHaveLength(1);
      }
    }
    expect(seen).toBeGreaterThan(30);
  });

  it("立体展开馆：面棱顶点三种问法都在，棱与顶点只问多面体", () => {
    const asks = new Set<string>();
    for (let level = 144; level < 166; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "solid") continue;
        asks.add(q.ask);
        if (q.ask.includes("棱") || q.ask.includes("顶点")) {
          expect(["cube", "cuboid", "triPrism", "squarePyramid", "triPyramid"]).toContain(
            attr(q.promptHTML, "data-solid")
          );
        }
      }
    }
    expect(asks.size).toBe(3);
  });

  it("展开图题：球不会被问展开图，选项里也没有重复描述", () => {
    let seen = 0;
    for (let level = 144; level < 166; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "net") continue;
        seen++;
        expect(attr(q.promptHTML, "data-solid")).not.toBe("sphere");
        expect(new Set(q.choices).size).toBe(3);
      }
    }
    expect(seen).toBeGreaterThan(10);
  });

  it("坐标方位岛：读坐标与多步行走都覆盖到了，且终点不出格", () => {
    const kinds = new Set<string>();
    for (let level = 166; level < 188; level++) {
      for (const q of buildQuestions(level)) kinds.add(q.kind);
    }
    expect(kinds.has("coord")).toBe(true);
    expect(kinds.has("path")).toBe(true);
    for (let level = 166; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "path") continue;
        const m = String(q.answer).match(/^\((\d+), (\d+)\)$/)!;
        expect(Number(m[1])).toBeGreaterThanOrEqual(1);
        expect(Number(m[1])).toBeLessThanOrEqual(6);
        expect(Number(m[2])).toBeGreaterThanOrEqual(1);
        expect(Number(m[2])).toBeLessThanOrEqual(6);
      }
    }
  });

  it("引入了前 99 关没有的新机制（周长面积 / 对称旋转 / 立体展开 / 坐标方位）", () => {
    const legacy = new Set<string>();
    for (let level = 0; level < 99; level++) for (const q of buildQuestions(level)) legacy.add(q.kind);
    const fresh = new Set<string>();
    for (const level of NEW_LEVELS) for (const q of buildQuestions(level)) fresh.add(q.kind);
    for (const k of legacy) expect(fresh.has(k), `${k} 不该出现在新章节`).toBe(false);
    expect(fresh.size).toBeGreaterThanOrEqual(2);
    expect([...fresh].every((k) => ADVANCED_KINDS.has(k))).toBe(true);
  });

  it("第 100–188 关同一关重试题目一致（确定性生成）", () => {
    for (const level of [99, 121, 122, 143, 144, 165, 166, 187]) {
      expect(JSON.stringify(buildQuestions(level))).toBe(JSON.stringify(buildQuestions(level)));
    }
  });

  it("引导语依旧口语化：全部 188 关的 ask 都不超过 15 个汉字", () => {
    for (let level = 0; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        expect((q.ask.match(/[\u4e00-\u9fff]/g) ?? []).length, `第 ${level + 1} 关：${q.ask}`).toBeLessThanOrEqual(15);
      }
    }
  });

  it("四个新章节的题型池互不相同，题量也明显更长", () => {
    const sigs = new Set([110, 133, 155, 180].map((i) => kindPool(i).slice().sort().join(",")));
    expect(sigs.size).toBe(4);
    expect(questionCount(121)).toBe(10);
    expect(questionCount(187)).toBe(10);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(NEW_LEVELS.map((i) => questionCount(i)))).toBeGreaterThan(
      avg(Array.from({ length: 99 }, (_, i) => questionCount(i)))
    );
  });
});
