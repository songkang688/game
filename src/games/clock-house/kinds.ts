/**
 * 时钟小屋 1.2：题型分类与「关号 → 题型权重」难度表。
 *
 * 这一份只放纯数据与纯函数（不 import 出题代码，也不被出题代码以外的东西依赖），
 * 让难度曲线变成一张能读、能断言的表，而不是散在 if-else 里的经验值。
 */

/** 1.2 规格要求补齐的 8 类题型 + `calendar`（1.1 已有的日历推理，续写保留不推翻） */
export const CLOCK_TYPES = [
  "readFace",
  "setHands",
  "elapsed",
  "shiftTime",
  "convert1224",
  "unitConvert",
  "schedule",
  "timezone",
  "calendar",
] as const;

export type ClockType = (typeof CLOCK_TYPES)[number];

/** 规格点名要有的那 8 类（`calendar` 不在其列，是 1.1 的存量内容） */
export const CORE_CLOCK_TYPES: readonly ClockType[] = [
  "readFace",
  "setHands",
  "elapsed",
  "shiftTime",
  "convert1224",
  "unitConvert",
  "schedule",
  "timezone",
];

/** 题型的中文名（提示语与错题统计要用） */
export const CLOCK_TYPE_NAMES: Record<ClockType, string> = {
  readFace: "读钟面",
  setHands: "拨指针",
  elapsed: "经过时间",
  shiftTime: "时刻加减",
  convert1224: "十二与二十四小时制",
  unitConvert: "时分秒换算",
  schedule: "作息表与时刻表",
  timezone: "跨城对表",
  calendar: "星期与日历",
};

/** 1.0/1.1 就有的题目种类 */
export type LegacyClockKind = "read" | "set" | "next";

/** 1.1 追加的进阶种类 */
export type AdvancedClockKind =
  | "span"
  | "arrive"
  | "depart"
  | "h24"
  | "h12"
  | "zone"
  | "weekday"
  | "monthdays"
  | "nthday"
  | "tableEarly"
  | "tableFast"
  | "tableWait";

/** 1.2 追加的种类：分钟级读钟面 / 拨指针、跨中午、时分秒换算、作息表 */
export type FreshClockKind = "readMin" | "setMin" | "spanNoon" | "unitHM" | "unitMS" | "unitMix" | "routine";

export type ClockKind = LegacyClockKind | AdvancedClockKind | FreshClockKind;

/** 每个种类归哪一类题型 */
export const KIND_TYPE: Record<ClockKind, ClockType> = {
  read: "readFace",
  readMin: "readFace",
  set: "setHands",
  setMin: "setHands",
  span: "elapsed",
  spanNoon: "elapsed",
  arrive: "shiftTime",
  depart: "shiftTime",
  next: "shiftTime",
  h24: "convert1224",
  h12: "convert1224",
  unitHM: "unitConvert",
  unitMS: "unitConvert",
  unitMix: "unitConvert",
  routine: "schedule",
  tableEarly: "schedule",
  tableFast: "schedule",
  tableWait: "schedule",
  zone: "timezone",
  weekday: "calendar",
  monthdays: "calendar",
  nthday: "calendar",
};

export function typeOfKind(kind: ClockKind): ClockType {
  return KIND_TYPE[kind];
}

/**
 * 第 100 关之后各题型可以派出的具体种类。
 * 刻意不含 `read` / `set` / `next` 三个 1.0 种类：那三种是前 99 关的专属形态，
 * 后 89 关要用的是分钟级的 `readMin` / `setMin` 与分钟级的时刻加减。
 */
export const ADVANCED_KINDS_BY_TYPE: Record<ClockType, readonly ClockKind[]> = {
  readFace: ["readMin"],
  setHands: ["setMin"],
  elapsed: ["span", "spanNoon"],
  shiftTime: ["arrive", "depart"],
  convert1224: ["h24", "h12"],
  unitConvert: ["unitHM", "unitMS", "unitMix"],
  schedule: ["routine", "tableEarly", "tableFast", "tableWait"],
  timezone: ["zone"],
  calendar: ["weekday", "monthdays", "nthday"],
};

// ---------------------------------------------------------------------------
// 难度表：关号 → 题型权重
// ---------------------------------------------------------------------------

export interface DifficultyBand {
  /** 覆盖的关号区间（1 基，含两端） */
  from: number;
  to: number;
  title: string;
  /** 题型 → 权重，一段之内必须正好加到 1 */
  weights: Partial<Record<ClockType, number>>;
}

/**
 * 八段难度曲线，从入门读钟面一路走到六年级综合。
 *
 * 前三段（第 1–99 关）是**如实描述**：那 99 关的出题参数在 1.0/1.1 就定死了，
 * 1.2 一个字不改，仍旧走 `kindPool` 的老阶梯；这里写下来是为了让整条曲线能一眼读完，
 * 测试会反过来校验这三段列出的题型和老代码真正产出的题型完全对得上。
 * 第 100 关往后才真正由这张表驱动出题。
 */
export const DIFFICULTY_TABLE: readonly DifficultyBand[] = [
  {
    from: 1,
    to: 30,
    title: "入门：整点与半点",
    weights: { readFace: 1 },
  },
  {
    from: 31,
    to: 67,
    title: "读到刻：一刻与三刻",
    weights: { readFace: 1 },
  },
  {
    from: 68,
    to: 99,
    title: "拨针工坊与混合挑战",
    weights: { setHands: 0.55, readFace: 0.3, shiftTime: 0.15 },
  },
  {
    from: 100,
    to: 122,
    title: "分钟级：经过时间与时刻加减",
    weights: { elapsed: 0.4, shiftTime: 0.35, readFace: 0.15, unitConvert: 0.1 },
  },
  {
    from: 123,
    to: 144,
    title: "两种计时法与跨城对表",
    weights: { convert1224: 0.45, timezone: 0.2, unitConvert: 0.2, elapsed: 0.15 },
  },
  {
    from: 145,
    to: 166,
    title: "日历、作息表与跨中午",
    weights: { calendar: 0.4, schedule: 0.3, elapsed: 0.15, convert1224: 0.1, setHands: 0.05 },
  },
  {
    from: 167,
    to: 177,
    title: "看懂一张班次表",
    weights: { schedule: 0.45, elapsed: 0.2, convert1224: 0.15, timezone: 0.1, unitConvert: 0.1 },
  },
  {
    from: 178,
    to: 188,
    title: "六年级综合：什么都可能来",
    weights: {
      elapsed: 0.2,
      convert1224: 0.2,
      unitConvert: 0.15,
      schedule: 0.15,
      shiftTime: 0.1,
      timezone: 0.05,
      readFace: 0.05,
      setHands: 0.05,
      calendar: 0.05,
    },
  },
];

/** 第一段真正由权重表驱动出题的关号（1 基）；小于它的关走 1.0/1.1 的老路径 */
export const TABLE_DRIVEN_FROM = 100;

/** 「高段」的起点（1 基）：这之后必须还在练经过时间与 24 小时制 */
export const SENIOR_FROM = 161;

/** 关号（1 基）落在哪一段 */
export function bandOf(level1: number): DifficultyBand {
  const n = Math.max(1, Math.round(level1));
  for (const band of DIFFICULTY_TABLE) {
    if (n >= band.from && n <= band.to) return band;
  }
  return DIFFICULTY_TABLE[DIFFICULTY_TABLE.length - 1];
}

/** 一段里权重大于 0 的题型，按权重从大到小、同权重按 CLOCK_TYPES 顺序排 */
export function bandTypes(band: DifficultyBand): ClockType[] {
  return CLOCK_TYPES.filter((t) => (band.weights[t] ?? 0) > 0).sort(
    (a, b) => (band.weights[b] ?? 0) - (band.weights[a] ?? 0) || CLOCK_TYPES.indexOf(a) - CLOCK_TYPES.indexOf(b)
  );
}

/**
 * 把 count 个题位按权重分给各题型（最大余数法，确定性）。
 * `rotate` 让相邻关卡把「余数题位」轮着给不同题型：不加这一手，
 * 权重并列的小题型会因为下标靠后被永远饿死，一章之内根本轮不到它。
 */
export function allocateSlots(
  band: DifficultyBand,
  count: number,
  rotate = 0
): Array<{ type: ClockType; slots: number }> {
  const total = Math.max(0, Math.round(count));
  const types = bandTypes(band);
  if (types.length === 0 || total === 0) return [];
  const raw = types.map((type) => ({ type, exact: (band.weights[type] ?? 0) * total }));
  const out = raw.map((x) => ({ type: x.type, slots: Math.floor(x.exact) }));
  let left = total - out.reduce((s, x) => s + x.slots, 0);
  const byRemainder = raw
    .map((x, i) => ({ i, rem: x.exact - Math.floor(x.exact) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  const start = ((Math.round(rotate) % byRemainder.length) + byRemainder.length) % byRemainder.length;
  for (let k = 0; left > 0; k++, left--) out[byRemainder[(start + k) % byRemainder.length].i].slots++;
  return out.filter((x) => x.slots > 0);
}

/**
 * 某一关（0 基）按难度表排出来的题型序列，长度正好等于题量。
 * 同一题型内部按「关号 + 题位」轮换具体种类，保证一章之内每个种类都轮得到，
 * 而且同一关重开时排法完全一致。
 */
export function tableKinds(level: number, count: number): ClockKind[] {
  const band = bandOf(level + 1);
  const alloc = allocateSlots(band, count, level);
  const out: ClockKind[] = [];
  alloc.forEach((entry, ti) => {
    const kinds = ADVANCED_KINDS_BY_TYPE[entry.type];
    for (let i = 0; i < entry.slots; i++) {
      out.push(kinds[(level + ti + i) % kinds.length]);
    }
  });
  return out;
}
