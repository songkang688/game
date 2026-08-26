/**
 * 战役可通关性模拟框架 —— 动作五款共用(1.1 第 4 步 / 角色 C 建)。
 *
 * 关卡表越写越长,光靠肉眼是看不出「第 173 关的资源曲线其实是个死局」的。
 * 这里提供一套与具体玩法无关的骨架:各游戏自己写一个「用固定策略把某一关跑完」
 * 的函数,交给这里批量跑、换种子重跑、汇总失败清单。
 *
 * 约定:
 *  - 这个文件不是测试用例(文件名不带 `.test.ts`,vitest 不会收集它),
 *    也不 import vitest,任何测试框架都能用。
 *  - 随机必须走这里的 `makeRng`,同一个种子必须跑出同一个结果,
 *    否则失败清单没法复现。
 *
 * 用法:
 * ```ts
 * const report = runCampaign(
 *   { game: "彩虹跑跑", total: 188, label: (i) => LEVELS[i].name, play: (i, rng) => simulateLevel(i, { rng }) },
 *   { from: 99, seeds: [1, 2, 3], mode: "any" },
 * );
 * expect(report.failures, formatReport(report)).toEqual([]);
 * ```
 */

/** 确定性随机源:同一个种子永远给出同一串数。 */
export type Rng = () => number;

/** mulberry32:实现短、分布够用、换种子就换一整条路线。 */
export function makeRng(seed: number): Rng {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 一关的模拟结果。各游戏可以在此之上加自己的字段。 */
export interface LevelOutcome {
  win: boolean;
  /** 失败原因,会原样出现在失败清单里 */
  note?: string;
}

export interface CampaignSpec<O extends LevelOutcome = LevelOutcome> {
  /** 打印用的游戏名 */
  game: string;
  /** 战役总关数 */
  total: number;
  /** 关卡名,用于失败清单 */
  label: (idx: number) => string;
  /** 用固定策略把第 idx 关(0 起)跑一遍 */
  play: (idx: number, rng: Rng) => O;
}

export interface CampaignFailure {
  /** 0 起的关卡下标 */
  idx: number;
  /** 1 起的关号,和界面上显示的一致 */
  level: number;
  label: string;
  /** 每个种子各自的失败说明 */
  notes: string[];
  seeds: number[];
}

export interface CampaignReport {
  game: string;
  /** 实际跑了多少关 */
  ran: number;
  /** 通过的关数 */
  passed: number;
  /** 一共跑了多少局(关数 × 种子数) */
  plays: number;
  failures: CampaignFailure[];
}

export interface CampaignOptions {
  /** 从第几关开始(0 起,含) */
  from?: number;
  /** 到第几关为止(0 起,不含);默认到 total */
  to?: number;
  /** 只跑这几关(给了就忽略 from/to) */
  only?: number[];
  /** 随机种子;默认 [1] */
  seeds?: number[];
  /**
   * every:每个种子都要赢(适合确定性强的玩法);
   * any:有一个种子赢就算这关不是死局(适合随机刷怪/刷障碍的玩法)。
   */
  mode?: "every" | "any";
  /** 失败清单最多留几条,避免刷屏;默认 12 */
  maxFailures?: number;
}

const DEFAULT_SEEDS = [1];

function levelRange(spec: CampaignSpec, opts: CampaignOptions): number[] {
  if (opts.only) return [...opts.only];
  const from = Math.max(0, opts.from ?? 0);
  const to = Math.min(spec.total, opts.to ?? spec.total);
  const out: number[] = [];
  for (let i = from; i < to; i++) out.push(i);
  return out;
}

/** 把一段关卡按固定策略跑一遍,回一份汇总。 */
export function runCampaign<O extends LevelOutcome>(
  spec: CampaignSpec<O>,
  opts: CampaignOptions = {},
): CampaignReport {
  const seeds = opts.seeds && opts.seeds.length > 0 ? opts.seeds : DEFAULT_SEEDS;
  const mode = opts.mode ?? "every";
  const maxFailures = opts.maxFailures ?? 12;
  const idxs = levelRange(spec, opts);

  const failures: CampaignFailure[] = [];
  let passed = 0;
  let plays = 0;

  for (const idx of idxs) {
    const badSeeds: number[] = [];
    const notes: string[] = [];
    let anyWin = false;
    for (const seed of seeds) {
      // 种子要和关号搅在一起,否则每关的随机序列一模一样,等于只测了一条路线
      const out = spec.play(idx, makeRng(seed * 7919 + idx * 31 + 1));
      plays++;
      if (out.win) {
        anyWin = true;
      } else {
        badSeeds.push(seed);
        notes.push(out.note ?? "没通关");
      }
    }
    const ok = mode === "any" ? anyWin : badSeeds.length === 0;
    if (ok) {
      passed++;
    } else if (failures.length < maxFailures) {
      failures.push({ idx, level: idx + 1, label: spec.label(idx), notes, seeds: badSeeds });
    }
  }

  return { game: spec.game, ran: idxs.length, passed, plays, failures };
}

/** 失败清单的可读文本,直接塞进断言的 message 里。 */
export function formatReport(report: CampaignReport): string {
  const head = `${report.game}:跑了 ${report.ran} 关(共 ${report.plays} 局),通过 ${report.passed} 关`;
  if (report.failures.length === 0) return `${head},全部通过`;
  const lines = report.failures.map(
    (f) => `  第 ${f.level} 关「${f.label}」种子 ${f.seeds.join("/")}:${[...new Set(f.notes)].join(";")}`,
  );
  return `${head},失败 ${report.failures.length} 关:\n${lines.join("\n")}`;
}

/** 全部通过就返回 true;没通过时抛出带清单的错误,方便直接在测试里调用。 */
export function assertAllWin(report: CampaignReport): true {
  if (report.failures.length > 0) throw new Error(formatReport(report));
  return true;
}

/**
 * 反向校验:这些关在「摆烂策略」下必须输。
 * 用来确认 Boss 关和限时关真的有失败分支,而不是躺着也能赢。
 */
export function runMustLose<O extends LevelOutcome>(
  spec: CampaignSpec<O>,
  idxs: number[],
  seeds: number[] = DEFAULT_SEEDS,
): CampaignReport {
  const failures: CampaignFailure[] = [];
  let passed = 0;
  let plays = 0;
  for (const idx of idxs) {
    const badSeeds: number[] = [];
    for (const seed of seeds) {
      const out = spec.play(idx, makeRng(seed * 7919 + idx * 31 + 1));
      plays++;
      if (out.win) badSeeds.push(seed);
    }
    if (badSeeds.length === 0) passed++;
    else {
      failures.push({
        idx,
        level: idx + 1,
        label: spec.label(idx),
        notes: ["摆烂也赢了,这一关没有真正的失败分支"],
        seeds: badSeeds,
      });
    }
  }
  return { game: `${spec.game}(摆烂必输)`, ran: idxs.length, passed, plays, failures };
}
