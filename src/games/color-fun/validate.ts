/**
 * 涂色小屋 · 关卡可解性校验器（1.2 新增，纯函数，不碰 DOM）。
 *
 * 1.1 的用例只断言「预算比要调的颜色多一个」，那是凑巧成立：
 * 一旦某个目标色需要两步才能调出来，或者压根没有配方，测试照样绿。
 * 这一份把「这关到底打不打得完」真的搜一遍：
 *
 *  1. **可解性**：以「手上有哪些颜色」为状态做 BFS，每开一次锅从可倒清单里取两样，
 *     受调色次数上限约束，搜不到就报不可解；
 *  2. **区域覆盖**：每一块都真的存在、不重复，而且按玩法都能查到自己的指令 /
 *     编号 / 图例符号 / 配色规则——画上有一块没人告诉孩子该涂什么，就是漏题；
 *  3. **可分辨**：同一屏上要区分的颜色两两 ΔE ≥ 阈值；渐变关再加一条，
 *     相邻两级的亮度差要够肉眼分出深浅。
 *
 * 用例拿它跑遍 188 关，**有一关不过就回去修数据**。
 */
import {
  MIN_SHADE_STEP,
  MIN_TARGET_DELTA_E,
  isPigment,
  mixName,
  pigmentDeltaE,
  pigmentLightness,
} from "./mix";
import { DEFAULT_POT_INPUTS, PICTURES, type ColorLevel } from "./levels";

/** 一条问题：`kind` 给用例分类，`detail` 给人看 */
export interface LevelIssue {
  kind:
    | "unknown-pigment"
    | "unknown-region"
    | "duplicate-region"
    | "no-instruction"
    | "unreachable-color"
    | "over-budget"
    | "too-similar"
    | "shade-step"
    | "shade-order"
    | "given-overlap";
  detail: string;
}

/** 一关能不能玩：`ok` 为真时 `issues` 一定是空的 */
export interface LevelReport {
  level: number;
  ok: boolean;
  issues: LevelIssue[];
  /** 至少要开几次锅（BFS 搜出来的最少次数），不用开锅就是 0 */
  minPours: number;
}

export interface ValidateOptions {
  /** 同一关里两种颜色至少要差多少 ΔE */
  minDeltaE?: number;
  /** 渐变关相邻两级至少要差多少亮度 */
  minShadeStep?: number;
}

/** 一次开锅的可倒清单：关卡指定的原料，外加已经调出来的颜色（`potChain` 打开时） */
function pourables(cfg: ColorLevel, held: ReadonlySet<string>): string[] {
  const base = cfg.potInputs ?? DEFAULT_POT_INPUTS;
  if (!cfg.potChain) return [...base];
  return [...new Set([...base, ...held])];
}

/**
 * BFS：从「调色盘里直接给的颜色」出发，每一步开一次锅，
 * 找出把 `wanted` 全部凑齐最少要开几次；预算内凑不齐返回 null。
 *
 * 状态是「手上这一套颜色」，用排好序的字符串当 key 去重；
 * 分支上界是可倒清单的两两组合，规模很小，跑 188 关不到一眨眼。
 */
export function searchMixPlan(
  cfg: ColorLevel,
  wanted: readonly string[],
  budget: number
): { pours: number; order: string[] } | null {
  const start = new Set(cfg.palette);
  const need = wanted.filter((c) => !start.has(c));
  if (need.length === 0) return { pours: 0, order: [] };
  if (budget <= 0) return null;

  const keyOf = (s: ReadonlySet<string>): string => [...s].sort().join("|");
  const seen = new Set<string>([keyOf(start)]);
  let frontier: Array<{ held: Set<string>; order: string[] }> = [{ held: start, order: [] }];

  for (let depth = 1; depth <= budget; depth++) {
    const next: Array<{ held: Set<string>; order: string[] }> = [];
    for (const node of frontier) {
      const inputs = pourables(cfg, node.held);
      for (let i = 0; i < inputs.length; i++) {
        for (let j = i; j < inputs.length; j++) {
          const out = mixName(inputs[i], inputs[j]);
          if (out === null || node.held.has(out)) continue;
          const held = new Set(node.held);
          held.add(out);
          const order = [...node.order, out];
          if (need.every((c) => held.has(c))) return { pours: depth, order };
          const k = keyOf(held);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ held, order });
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return null;
}

/** 这一关孩子在同一屏上要分清的全部颜色（要涂的 + 已经涂好的参照 + 调色盘里能选的） */
export function levelColors(cfg: ColorLevel): string[] {
  return [
    ...new Set([
      ...cfg.tasks.map((t) => t.color),
      ...(cfg.given ?? []).map((g) => g.color),
      ...cfg.palette,
      ...cfg.needMix,
    ]),
  ];
}

/** 按玩法查「这一块有没有告诉孩子该涂什么」 */
function hasInstruction(cfg: ColorLevel, region: string, color: string): boolean {
  if (cfg.mode === "legend") return (cfg.legend ?? []).some((it) => it.color === color);
  if (cfg.mode === "number") return cfg.palette.includes(color);
  if (cfg.mode === "rule") {
    const rule = (cfg.rules ?? []).find((r) => r.region === region);
    return rule !== undefined && (cfg.given ?? []).some((g) => g.region === rule.refRegion);
  }
  // guide / mix / memory / shade / limited 都是一块一条文字指令，跟着 tasks 走
  return true;
}

/** 校验一关。返回空数组表示这一关没问题 */
export function validateLevel(cfg: ColorLevel, level = 0, opts: ValidateOptions = {}): LevelIssue[] {
  const minDeltaE = opts.minDeltaE ?? MIN_TARGET_DELTA_E;
  const minStep = opts.minShadeStep ?? MIN_SHADE_STEP;
  const issues: LevelIssue[] = [];
  const at = `第 ${level + 1} 关`;

  const pic = PICTURES[cfg.pic];
  if (!pic) {
    issues.push({ kind: "unknown-region", detail: `${at} 用了不存在的线稿 #${cfg.pic}` });
    return issues;
  }
  const regionIds = new Set(pic.regions.map((r) => r.id));

  // 1) 区域与指令
  const seenRegion = new Set<string>();
  for (const task of cfg.tasks) {
    if (!regionIds.has(task.region)) {
      issues.push({ kind: "unknown-region", detail: `${at} 的「${task.region}」不在线稿「${pic.name}」里` });
    }
    if (seenRegion.has(task.region)) {
      issues.push({ kind: "duplicate-region", detail: `${at} 的「${task.region}」被安排了两次` });
    }
    seenRegion.add(task.region);
    if (!isPigment(task.color)) {
      issues.push({ kind: "unknown-pigment", detail: `${at} 要涂的「${task.color}」不是本作的颜料` });
    }
    if (!hasInstruction(cfg, task.region, task.color)) {
      issues.push({ kind: "no-instruction", detail: `${at} 的「${task.region}」没有对应的指令 / 编号 / 图例` });
    }
  }
  for (const g of cfg.given ?? []) {
    if (!regionIds.has(g.region)) {
      issues.push({ kind: "unknown-region", detail: `${at} 的参照块「${g.region}」不在线稿里` });
    }
    if (seenRegion.has(g.region)) {
      issues.push({ kind: "given-overlap", detail: `${at} 的「${g.region}」既是参照又要孩子涂` });
    }
  }

  // 2) 可解性：需要调的颜色，在给定预算内 BFS 搜得到吗
  const wanted = [...new Set(cfg.tasks.map((t) => t.color))];
  const budget = cfg.budget ?? wanted.length + cfg.needMix.length + 4;
  const plan = searchMixPlan(cfg, wanted, budget);
  if (plan === null) {
    const missing = wanted.filter((c) => !cfg.palette.includes(c));
    const kind = missing.some((c) => searchMixPlan(cfg, [c], 8) === null) ? "unreachable-color" : "over-budget";
    issues.push({
      kind,
      detail: `${at} 在 ${budget} 次开锅内调不出 ${missing.join("、")}（调色盘：${cfg.palette.join("、")}）`,
    });
  }
  for (const c of cfg.needMix) {
    if (cfg.palette.includes(c)) {
      issues.push({ kind: "unreachable-color", detail: `${at} 的「${c}」既在调色盘里又要求调色，前后矛盾` });
    }
  }

  // 3) 可分辨：同一屏上的颜色两两差得开
  const colors = levelColors(cfg);
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = pigmentDeltaE(colors[i], colors[j]);
      if (d < minDeltaE) {
        issues.push({
          kind: "too-similar",
          detail: `${at} 的「${colors[i]}」与「${colors[j]}」只差 ΔE ${d.toFixed(1)}，孩子分不出来`,
        });
      }
    }
  }

  // 4) 渐变关：每一组内部都由浅到深，且每一级都亮得出差别。
  //    换组时会重新从最浅的开始，所以顺序只在组内查，跨组那一步不算「方向反了」。
  if (cfg.order) {
    const seq = cfg.tasks.map((t) => t.color);
    const sizes = cfg.orderGroups ?? [seq.length];
    let cursor = 0;
    for (const size of sizes) {
      const group = seq.slice(cursor, cursor + size);
      cursor += size;
      for (let i = 1; i < group.length; i++) {
        const step = pigmentLightness(group[i - 1]) - pigmentLightness(group[i]);
        if (step <= 0) {
          issues.push({
            kind: "shade-order",
            detail: `${at} 要从「${group[i - 1]}」涂到更浅的「${group[i]}」，方向反了`,
          });
        } else if (step < minStep) {
          issues.push({
            kind: "shade-step",
            detail: `${at} 的「${group[i - 1]}」与「${group[i]}」只差 ${step.toFixed(1)} 点亮度，看不出深浅`,
          });
        }
      }
    }
    if (cursor !== seq.length) {
      issues.push({ kind: "shade-order", detail: `${at} 的分组长度加起来是 ${cursor}，画上却有 ${seq.length} 块要涂` });
    }
  }

  return issues;
}

/** 跑一整套关卡，返回每关一份报告 */
export function validateAll(levels: readonly ColorLevel[], opts: ValidateOptions = {}): LevelReport[] {
  return levels.map((cfg, i) => {
    const issues = validateLevel(cfg, i, opts);
    const plan = searchMixPlan(cfg, [...new Set(cfg.tasks.map((t) => t.color))], cfg.budget ?? 12);
    return { level: i, ok: issues.length === 0, issues, minPours: plan?.pours ?? -1 };
  });
}
