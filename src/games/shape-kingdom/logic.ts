// 形状王国：分类出题纯逻辑

export type ShapeKind = "circle" | "triangle" | "square";
export type ShapeColor = "red" | "yellow" | "blue";

export const SHAPE_KINDS: ShapeKind[] = ["circle", "triangle", "square"];
export const SHAPE_COLORS: ShapeColor[] = ["red", "yellow", "blue"];

export const SHAPE_NAMES: Record<ShapeKind, string> = {
  circle: "圆形",
  triangle: "三角形",
  square: "方形",
};

export const COLOR_NAMES: Record<ShapeColor, string> = {
  red: "红色",
  yellow: "黄色",
  blue: "蓝色",
};

export const COLOR_VALUES: Record<ShapeColor, string> = {
  red: "#fa5252",
  yellow: "#ffd43b",
  blue: "#4dabf7",
};

export type ShapeRound = {
  /** 本轮按什么分类：形状 或 颜色 */
  mode: "shape" | "color";
  shape: ShapeKind;
  color: ShapeColor;
  /** 三扇城堡门的取值（形状名或颜色名的 key），已打乱 */
  bins: string[];
  answerIndex: number;
};

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeShapeRound(rand: () => number = Math.random, mode?: "shape" | "color"): ShapeRound {
  const m: "shape" | "color" = mode ?? (rand() < 0.5 ? "shape" : "color");
  const shape = pick(SHAPE_KINDS, rand);
  const color = pick(SHAPE_COLORS, rand);
  const bins = m === "shape" ? shuffle(SHAPE_KINDS.slice(), rand) : shuffle(SHAPE_COLORS.slice(), rand);
  const answer = m === "shape" ? shape : color;
  return { mode: m, shape, color, bins, answerIndex: bins.indexOf(answer) };
}
