/**
 * 识字小花园 1.2：笔顺描红的数据与判定（纯数据 + 纯函数，不碰 DOM）。
 *
 * 收字原则是 **宁可少而对，不许多而错**：只收前三章里笔顺我能逐笔说清楚的高频字。
 * 社会上写法有分歧的（比如「田」中间那一横一竖谁先谁后）一律不收 —— 教材内容错一个都是教学事故。
 *
 * 坐标系是一张 100×100 的田字格，(0,0) 在左上角。每一笔是一条折线：
 * 点按书写方向排，第一个点是**起笔**，最后一个点是**收笔**。
 * 折线只求「起收位置、走向、拐点」对得上，不追求印刷体的粗细提按 ——
 * 描红要教的是**顺序和方向**，这两样必须准。
 */

/** 田字格边长（描红台的字与判定共用这一套坐标） */
export const GRID = 100;

export type Point = readonly [number, number];

export interface Stroke {
  /** 笔画名，例如「横」「竖钩」「横折折折钩」 */
  name: string;
  /** 折线路径，按书写方向排，至少两个点 */
  points: Point[];
}

export interface StrokeChar {
  char: string;
  pinyin: string;
  /** 按顺序排好的每一笔 */
  strokes: Stroke[];
}

export const STROKE_CHARS: StrokeChar[] = [
  {
    char: "一",
    pinyin: "yī",
    strokes: [{ name: "横", points: [[14, 50], [86, 50]] }],
  },
  {
    char: "二",
    pinyin: "èr",
    strokes: [
      { name: "横", points: [[22, 34], [78, 34]] },
      { name: "横", points: [[14, 70], [86, 70]] },
    ],
  },
  {
    char: "三",
    pinyin: "sān",
    strokes: [
      { name: "横", points: [[24, 26], [76, 26]] },
      { name: "横", points: [[28, 50], [72, 50]] },
      { name: "横", points: [[14, 76], [86, 76]] },
    ],
  },
  {
    char: "十",
    pinyin: "shí",
    strokes: [
      { name: "横", points: [[14, 50], [86, 50]] },
      { name: "竖", points: [[50, 12], [50, 88]] },
    ],
  },
  {
    char: "人",
    pinyin: "rén",
    strokes: [
      { name: "撇", points: [[54, 14], [18, 86]] },
      { name: "捺", points: [[52, 32], [84, 86]] },
    ],
  },
  {
    char: "八",
    pinyin: "bā",
    strokes: [
      { name: "撇", points: [[40, 20], [18, 84]] },
      { name: "捺", points: [[58, 20], [84, 84]] },
    ],
  },
  {
    char: "七",
    pinyin: "qī",
    strokes: [
      { name: "横", points: [[16, 38], [80, 34]] },
      { name: "竖弯钩", points: [[54, 16], [48, 74], [82, 74], [82, 60]] },
    ],
  },
  {
    char: "九",
    pinyin: "jiǔ",
    strokes: [
      { name: "撇", points: [[52, 18], [24, 86]] },
      { name: "横折弯钩", points: [[28, 32], [78, 32], [78, 74], [88, 66]] },
    ],
  },
  {
    char: "五",
    pinyin: "wǔ",
    strokes: [
      { name: "横", points: [[20, 20], [80, 20]] },
      { name: "竖", points: [[38, 20], [32, 58]] },
      { name: "横折", points: [[32, 58], [70, 58], [70, 80]] },
      { name: "横", points: [[16, 80], [84, 80]] },
    ],
  },
  {
    char: "六",
    pinyin: "liù",
    strokes: [
      { name: "点", points: [[50, 10], [50, 24]] },
      { name: "横", points: [[16, 38], [84, 38]] },
      { name: "撇", points: [[36, 52], [20, 84]] },
      { name: "点", points: [[64, 52], [80, 84]] },
    ],
  },
  {
    char: "四",
    pinyin: "sì",
    strokes: [
      { name: "竖", points: [[18, 22], [18, 80]] },
      { name: "横折", points: [[18, 22], [82, 22], [82, 80]] },
      { name: "撇", points: [[40, 34], [33, 68]] },
      { name: "竖弯", points: [[60, 34], [60, 66], [82, 66]] },
      { name: "横", points: [[18, 80], [82, 80]] },
    ],
  },
  {
    char: "口",
    pinyin: "kǒu",
    strokes: [
      { name: "竖", points: [[24, 20], [24, 84]] },
      { name: "横折", points: [[24, 20], [76, 20], [76, 84]] },
      { name: "横", points: [[24, 84], [76, 84]] },
    ],
  },
  {
    char: "日",
    pinyin: "rì",
    strokes: [
      { name: "竖", points: [[28, 14], [28, 86]] },
      { name: "横折", points: [[28, 14], [72, 14], [72, 86]] },
      { name: "横", points: [[28, 50], [72, 50]] },
      { name: "横", points: [[28, 86], [72, 86]] },
    ],
  },
  {
    char: "目",
    pinyin: "mù",
    strokes: [
      { name: "竖", points: [[30, 12], [30, 88]] },
      { name: "横折", points: [[30, 12], [70, 12], [70, 88]] },
      { name: "横", points: [[30, 37], [70, 37]] },
      { name: "横", points: [[30, 62], [70, 62]] },
      { name: "横", points: [[30, 88], [70, 88]] },
    ],
  },
  {
    char: "月",
    pinyin: "yuè",
    strokes: [
      { name: "撇", points: [[40, 14], [28, 88]] },
      { name: "横折钩", points: [[40, 14], [72, 14], [72, 82], [58, 88]] },
      { name: "横", points: [[33, 40], [72, 40]] },
      { name: "横", points: [[30, 64], [72, 64]] },
    ],
  },
  {
    char: "山",
    pinyin: "shān",
    strokes: [
      { name: "竖", points: [[50, 18], [50, 74]] },
      { name: "竖折", points: [[22, 32], [22, 80], [80, 80]] },
      { name: "竖", points: [[80, 26], [80, 80]] },
    ],
  },
  {
    char: "木",
    pinyin: "mù",
    strokes: [
      { name: "横", points: [[14, 36], [86, 36]] },
      { name: "竖", points: [[50, 14], [50, 88]] },
      { name: "撇", points: [[48, 40], [16, 84]] },
      { name: "捺", points: [[52, 40], [84, 84]] },
    ],
  },
  {
    char: "水",
    pinyin: "shuǐ",
    strokes: [
      { name: "竖钩", points: [[50, 12], [50, 80], [38, 72]] },
      { name: "横撇", points: [[46, 34], [28, 40], [16, 68]] },
      { name: "撇", points: [[44, 54], [24, 84]] },
      { name: "捺", points: [[56, 44], [84, 84]] },
    ],
  },
  {
    char: "火",
    pinyin: "huǒ",
    strokes: [
      { name: "点", points: [[34, 20], [26, 34]] },
      { name: "撇", points: [[72, 20], [62, 34]] },
      { name: "撇", points: [[52, 26], [18, 86]] },
      { name: "捺", points: [[46, 46], [84, 86]] },
    ],
  },
  {
    char: "天",
    pinyin: "tiān",
    strokes: [
      { name: "横", points: [[24, 26], [76, 26]] },
      { name: "横", points: [[14, 48], [86, 48]] },
      { name: "撇", points: [[50, 48], [18, 86]] },
      { name: "捺", points: [[50, 48], [84, 86]] },
    ],
  },
  {
    char: "云",
    pinyin: "yún",
    strokes: [
      { name: "横", points: [[26, 24], [74, 24]] },
      { name: "横", points: [[16, 46], [84, 46]] },
      { name: "撇折", points: [[62, 56], [34, 80], [70, 80]] },
      { name: "点", points: [[74, 60], [82, 74]] },
    ],
  },
  {
    char: "手",
    pinyin: "shǒu",
    strokes: [
      { name: "撇", points: [[66, 18], [38, 30]] },
      { name: "横", points: [[24, 34], [80, 34]] },
      { name: "横", points: [[18, 58], [84, 58]] },
      { name: "竖钩", points: [[56, 14], [56, 86], [42, 78]] },
    ],
  },
  {
    char: "心",
    pinyin: "xīn",
    strokes: [
      { name: "点", points: [[28, 36], [22, 50]] },
      { name: "卧钩", points: [[36, 54], [48, 78], [74, 68], [72, 56]] },
      { name: "点", points: [[48, 42], [54, 54]] },
      { name: "点", points: [[70, 32], [78, 44]] },
    ],
  },
  {
    char: "门",
    pinyin: "mén",
    strokes: [
      { name: "点", points: [[32, 16], [24, 28]] },
      { name: "竖", points: [[24, 34], [24, 86]] },
      { name: "横折钩", points: [[24, 34], [78, 34], [78, 80], [66, 86]] },
    ],
  },
  {
    char: "牛",
    pinyin: "niú",
    strokes: [
      { name: "撇", points: [[42, 22], [26, 38]] },
      { name: "横", points: [[26, 40], [72, 40]] },
      { name: "横", points: [[16, 64], [86, 64]] },
      { name: "竖", points: [[52, 16], [52, 88]] },
    ],
  },
  {
    char: "马",
    pinyin: "mǎ",
    strokes: [
      { name: "横折", points: [[28, 22], [68, 22], [68, 44]] },
      { name: "竖折折钩", points: [[28, 44], [68, 44], [68, 70], [22, 70], [26, 60]] },
      { name: "横", points: [[14, 70], [86, 70]] },
    ],
  },
  {
    char: "鸟",
    pinyin: "niǎo",
    strokes: [
      { name: "撇", points: [[48, 12], [34, 24]] },
      { name: "横折钩", points: [[34, 24], [70, 24], [70, 40]] },
      { name: "点", points: [[46, 33], [56, 33]] },
      { name: "竖折折钩", points: [[34, 46], [70, 46], [70, 70], [24, 70], [28, 60]] },
      { name: "横", points: [[14, 70], [86, 70]] },
    ],
  },
  {
    char: "米",
    pinyin: "mǐ",
    strokes: [
      { name: "点", points: [[36, 18], [28, 32]] },
      { name: "撇", points: [[72, 18], [62, 32]] },
      { name: "横", points: [[16, 44], [84, 44]] },
      { name: "竖", points: [[50, 14], [50, 86]] },
      { name: "撇", points: [[46, 52], [20, 84]] },
      { name: "捺", points: [[54, 52], [80, 84]] },
    ],
  },
  {
    char: "电",
    pinyin: "diàn",
    strokes: [
      { name: "竖", points: [[32, 22], [32, 66]] },
      { name: "横折", points: [[32, 22], [68, 22], [68, 66]] },
      { name: "横", points: [[32, 44], [68, 44]] },
      { name: "横", points: [[32, 66], [68, 66]] },
      { name: "竖弯钩", points: [[50, 10], [50, 84], [86, 84], [86, 72]] },
    ],
  },
  {
    char: "耳",
    pinyin: "ěr",
    strokes: [
      { name: "横", points: [[24, 18], [76, 18]] },
      { name: "竖", points: [[36, 18], [36, 76]] },
      { name: "竖", points: [[64, 18], [64, 76]] },
      { name: "横", points: [[36, 40], [64, 40]] },
      { name: "横", points: [[36, 58], [64, 58]] },
      { name: "横", points: [[14, 76], [86, 76]] },
    ],
  },
];

const BY_CHAR = new Map(STROKE_CHARS.map((c) => [c.char, c]));

/** 有没有这个字的笔顺数据 */
export function hasStrokes(char: string): boolean {
  return BY_CHAR.has(char);
}

/** 取一个字的笔顺（没有就返回 null，调用方自己降级，绝不抛异常） */
export function strokesOf(char: string): StrokeChar | null {
  return BY_CHAR.get(char) ?? null;
}

/** 一个字有几笔 */
export function strokeCount(char: string): number {
  return BY_CHAR.get(char)?.strokes.length ?? 0;
}

/** 一个字的笔画名依次排开，例如「日」→ 竖、横折、横、横 */
export function strokeNames(char: string): string[] {
  return (BY_CHAR.get(char)?.strokes ?? []).map((s) => s.name);
}

// ---------------------------------------------------------------------------
// 判定：孩子画的这一道，是不是当前该描的那一笔
// ---------------------------------------------------------------------------

/** 判定容差（田字格坐标）：起收笔各自允许偏这么远 */
export const END_TOLERANCE = 24;
/** 中途允许离开笔画中线这么远 */
export const PATH_TOLERANCE = 22;

function dist(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** 点到线段的最短距离 */
export function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 点到整条折线的最短距离 */
export function pointToStroke(p: Point, stroke: Stroke): number {
  let best = Infinity;
  for (let i = 0; i + 1 < stroke.points.length; i++) {
    best = Math.min(best, pointToSegment(p, stroke.points[i], stroke.points[i + 1]));
  }
  return best;
}

/**
 * 这一道轨迹跟这一笔的贴合程度：0 分最差、1 分最好。
 * 起笔、收笔各占一半，中途跑偏按平均偏离扣分。方向反了拿不到分。
 */
export function traceScore(stroke: Stroke, path: readonly Point[]): number {
  if (path.length < 2 || stroke.points.length < 2) return 0;
  const head = path[0];
  const tail = path[path.length - 1];
  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  const headScore = Math.max(0, 1 - dist(head, start) / (END_TOLERANCE * 2));
  const tailScore = Math.max(0, 1 - dist(tail, end) / (END_TOLERANCE * 2));
  let off = 0;
  for (const p of path) off += pointToStroke(p, stroke);
  const pathScore = Math.max(0, 1 - off / path.length / (PATH_TOLERANCE * 2));
  return headScore * 0.35 + tailScore * 0.35 + pathScore * 0.3;
}

/** 这一道到底算不算把这一笔描出来了 */
export function isStrokeTraced(stroke: Stroke, path: readonly Point[]): boolean {
  if (path.length < 2 || stroke.points.length < 2) return false;
  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  if (dist(path[0], start) > END_TOLERANCE) return false;
  if (dist(path[path.length - 1], end) > END_TOLERANCE) return false;
  for (const p of path) {
    if (pointToStroke(p, stroke) > PATH_TOLERANCE) return false;
  }
  return true;
}

export type TraceVerdict =
  /** 就是该描的这一笔，收下 */
  | { kind: "right"; index: number }
  /** 描的是这个字里另外一笔，顺序反了 —— 温和提示重来，不扣分 */
  | { kind: "outOfOrder"; index: number; expected: number }
  /** 没描到任何一笔上，让孩子顺着虚线再来一次 */
  | { kind: "miss"; expected: number };

/**
 * 判一道轨迹：先看是不是当前该描的那一笔，
 * 不是的话再看它像不像这个字里别的笔画（顺序反了要说清楚是第几笔）。
 * @param done 已经描完几笔
 */
export function judgeTrace(char: string, done: number, path: readonly Point[]): TraceVerdict {
  const data = BY_CHAR.get(char);
  if (!data) return { kind: "miss", expected: done };
  const expected = Math.max(0, Math.min(done, data.strokes.length - 1));
  if (isStrokeTraced(data.strokes[expected], path)) return { kind: "right", index: expected };
  let best = -1;
  let bestScore = 0.55;
  data.strokes.forEach((s, i) => {
    if (i === expected) return;
    const score = traceScore(s, path);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  if (best >= 0) return { kind: "outOfOrder", index: best, expected };
  return { kind: "miss", expected };
}

/** 描错顺序时说的话：只指路，不说孩子错 */
export function traceHint(verdict: TraceVerdict, char: string): string {
  const names = strokeNames(char);
  if (verdict.kind === "right") return `第 ${verdict.index + 1} 笔「${names[verdict.index]}」写好啦！`;
  const expectedName = names[Math.min(verdict.expected, names.length - 1)] ?? "第一笔";
  if (verdict.kind === "outOfOrder") {
    return `那一笔留到后面写～先来第 ${verdict.expected + 1} 笔「${expectedName}」。`;
  }
  return `顺着虚线慢慢描第 ${verdict.expected + 1} 笔「${expectedName}」，从圆点起笔。`;
}

/** 整字描完的夸奖（一个字一朵花） */
export function traceDoneLine(char: string): string {
  return `「${char}」${strokeCount(char)} 笔一笔不差，花园里开出一朵花！`;
}

// ---------------------------------------------------------------------------
// 描红关：一关描几个字
// ---------------------------------------------------------------------------

export interface TraceTask {
  chars: StrokeChar[];
}

/** 生成一关的描红任务（确定性：同一关重开描的是同样几个字） */
export function traceTask(level: number, count = 3): TraceTask {
  const total = STROKE_CHARS.length;
  const n = Math.max(1, Math.min(count, total));
  const start = ((level % total) + total) % total;
  const chars: StrokeChar[] = [];
  for (let i = 0; i < n; i++) chars.push(STROKE_CHARS[(start + i * 7) % total]);
  // 同一关不描重复的字：撞上了就往后顺延一个
  const seen = new Set<string>();
  const out: StrokeChar[] = [];
  for (const c of chars) {
    let pickIdx = STROKE_CHARS.indexOf(c);
    let guard = 0;
    while (seen.has(STROKE_CHARS[pickIdx].char) && guard++ < total) pickIdx = (pickIdx + 1) % total;
    seen.add(STROKE_CHARS[pickIdx].char);
    out.push(STROKE_CHARS[pickIdx]);
  }
  return { chars: out };
}
