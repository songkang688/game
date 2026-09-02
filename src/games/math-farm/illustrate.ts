/**
 * 算数小农场 1.3 · 题目实物化插图（纯函数，不碰 DOM、不碰玩法）。
 *
 * 题面文本**原样保留**，这一层只是给加减法配一组自绘作物图：
 * 3 + 2 就摆 3 个萝卜 + 2 个萝卜，作物随题号轮换（萝卜 / 番茄 / 玉米 / 南瓜）；
 * 数量 > 10 换「一筐 = 10」的筐子约定（×10 角标 + 图例一行）。
 *
 * 插图**完全由题目数据驱动**：竖式题直接读 `spec`，口算题只读 `promptHTML`
 * 的纯文本（`strip` 之后正则解析），从头到尾没有任何一处反向改动题目数据。
 * 解析不出来（分数 / 方程 / 应用题…）就返回 null，题卡保持清爽。
 */
import { BASKET_UNIT, CROP_NAMES, basket, crop, cropAt, type CropKind } from "../../art/kit/crops";
import { hasSticker, sticker, stickerName } from "../../art/kit/stickers";
import { COUNT_PX, CROP_PX } from "./farmScene";
import { strip, type MathSpec } from "./gen";

/** 单个操作数的上限：三位数摆出来就是一片密密麻麻，宁可不配图 */
export const ILLUS_MAX_OPERAND = 99;

/** 插图只认得的问题形状（`MathQ` 与前 99 关的老题都长这样） */
export interface IllusSource {
  promptHTML: string;
  spec?: MathSpec;
}

/** 一个数摆成几筐几个 */
export interface IllusGroup {
  n: number;
  baskets: number;
  singles: number;
}

export interface IllusPlan {
  /** 题面上的操作数（原样，从不改写） */
  nums: number[];
  /** 操作数之间的符号（+ / −） */
  ops: string[];
  groups: IllusGroup[];
  usesBasket: boolean;
  crop: CropKind;
}

/** n 摆成几筐几个：> 10 才动用筐子（10 本身照实摆 10 个） */
export function splitCount(n: number): IllusGroup {
  if (n > BASKET_UNIT) {
    return { n, baskets: Math.floor(n / BASKET_UNIT), singles: n % BASKET_UNIT };
  }
  return { n, baskets: 0, singles: n };
}

/**
 * 从题目数据里读出「能摆实物」的操作数：
 * 竖式读 `spec`；口算加减（含连加连减）读题面纯文本。读不出返回 null。
 */
export function operandsOf(q: IllusSource): { nums: number[]; ops: string[] } | null {
  if (q.spec?.kind === "vertical") {
    return { nums: [q.spec.a, q.spec.b], ops: [q.spec.plus ? "+" : "−"] };
  }
  if (q.spec) return null; // 其余带参数的题型（分数 / 百分数…）不硬配图
  const text = strip(q.promptHTML);
  const m = text.match(/^(\d+) ([+-]) (\d+)(?: ([+-]) (\d+))? = \?$/);
  if (!m) return null;
  const nums = [Number(m[1]), Number(m[3])];
  const ops = [m[2] === "+" ? "+" : "−"];
  if (m[4] && m[5]) {
    nums.push(Number(m[5]));
    ops.push(m[4] === "+" ? "+" : "−");
  }
  return { nums, ops };
}

/**
 * 一道题的插图计划：`qIndex` 决定这题摆哪种作物（题号轮换）。
 * 操作数为 0 或超过上限时不配图（0 个没法摆，三位数摆不下）。
 */
export function illustrationPlan(q: IllusSource, qIndex: number): IllusPlan | null {
  const got = operandsOf(q);
  if (!got) return null;
  if (got.nums.some((n) => n <= 0 || n > ILLUS_MAX_OPERAND || !Number.isInteger(n))) return null;
  const groups = got.nums.map(splitCount);
  return {
    nums: got.nums,
    ops: got.ops,
    groups,
    usesBasket: groups.some((g) => g.baskets > 0),
    crop: cropAt(qIndex),
  };
}

/** 筐子约定的图例文案（放题目卡底部） */
export function basketLegend(kind: CropKind): string {
  return `🧺 一筐 = ${BASKET_UNIT} 个${CROP_NAMES[kind]}`;
}

/**
 * 插图计划 → HTML 字符串（span + 内联 SVG，无位图）。
 * 结构约定给测试钉死：每个实物单元带 `data-unit="one"`，
 * 每个筐子带 `data-unit="basket"`，组带 `data-n="原数"`。
 */
export function renderIllustration(plan: IllusPlan): string {
  const one = `<span class="mtf-illus-unit" data-unit="one">${crop(plan.crop, "fruit", CROP_PX)}</span>`;
  const pack = `<span class="mtf-illus-unit mtf-illus-basket" data-unit="basket">${basket(CROP_PX)}</span>`;
  const parts: string[] = [];
  plan.groups.forEach((g, i) => {
    if (i > 0) parts.push(`<span class="mtf-illus-op">${plan.ops[i - 1]}</span>`);
    parts.push(
      `<span class="mtf-illus-group" data-n="${g.n}">${pack.repeat(g.baskets)}${one.repeat(g.singles)}</span>`
    );
  });
  if (plan.usesBasket) {
    parts.push(`<span class="mtf-illus-legend">${basketLegend(plan.crop)}</span>`);
  }
  return parts.join("");
}

// ---------------------------------------------------------------------------
// 数一数题的贴纸行（W8R1-01：计数物由裸 emoji 换成 kit 贴纸自绘）
// ---------------------------------------------------------------------------

/** 数一数一行最多摆几个才肯配贴纸（关卡出题上限 10，留点冗余） */
export const COUNT_ILLUS_MAX = 12;

export interface CountPlan {
  /** 题面上重复的那个 emoji（原样，从不改写） */
  emoji: string;
  n: number;
  /** 贴纸的中文名（读屏 / 调试用） */
  name: string;
}

/**
 * 数一数题的贴纸计划：题面纯文本是「同一个 emoji 重复 n 次」时成立。
 * 和 `operandsOf` 一样只读题面，从不反向改动题目数据；
 * 解析不出（算式 / 混排 / 图集没画过的 emoji）返回 null，走原来的路。
 */
export function countPlan(q: IllusSource): CountPlan | null {
  if (q.spec) return null;
  const text = strip(q.promptHTML);
  if (!text || /[0-9=+\-×÷?？]/.test(text)) return null;
  const tokens = text.split(" ");
  if (tokens.length < 2 || tokens.length > COUNT_ILLUS_MAX) return null;
  const first = tokens[0];
  if (!tokens.every((t) => t === first)) return null;
  if (!hasSticker(first)) return null;
  return { emoji: first, n: tokens.length, name: stickerName(first) ?? "" };
}

/**
 * 贴纸计划 → HTML。结构约定与算式插图同一套：
 * 单元带 `data-unit="one"`，组带 `data-n="原数"`；原 emoji 行留在题卡的
 * sr-only 里（视觉层负责挂类），这行贴纸自己是 aria-hidden 的装饰。
 */
export function renderCountIllustration(plan: CountPlan): string {
  const unit = `<span class="mtf-illus-unit mtf-illus-count-unit" data-unit="one">${sticker(plan.emoji, COUNT_PX)}</span>`;
  return `<span class="mtf-illus-group" data-n="${plan.n}">${unit.repeat(plan.n)}</span>`;
}
