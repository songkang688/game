/**
 * 窗口 5 · 第 3 轮 档C 测试员 · 五款的难度曲线量化守门。
 *
 * 收官轮点名要「难度曲线量化」。前两轮的用例都在验**单关能不能通**，
 * 没有一份在验**188 关连起来是什么形状**。这一份给每款算一个纯数字的难度指数
 * （只读关卡配置，不跑 UI、不跑机器人），再把 188 关的形状卡成三条线。
 *
 * 量出来的形状是「**每章先回落、章内再爬**」——1.1 / 1.2 每加一个新玩法就开新章，
 * 新章头一关会比上一章末尾轻，让孩子先学会新玩法，再在章内加码。所以这里
 * **不卡章与章之间单调**（那样会把这个正确的设计判成 bug），改卡：
 *
 * 1. **章内必涨**：每章后三分之一的平均难度要高过前三分之一。
 * 2. **回落有底**：新章的平均难度不许跌到上一章的三分之一以下——回落是教学，
 *    跌穿了就是断层。
 * 3. **整条在涨**：末 5 关的平均难度至少是首 5 关的 1.8 倍。
 * 4. **章内无断崖**：以 9 关滑动窗口看，章内相邻两窗的跳幅不许超过该章均值的一半。
 *    用滑窗是因为逐关指数本来就有程序生成的抖动，逐关比会把抖动误判成断崖。
 *
 * 指数的算法写在每个函数上头，都是「孩子真能感觉到的量」的加权和；
 * 一个被测代码里现成的难度字段都不用——那种字段本身就可能是错的。
 */
import { describe, expect, it } from "vitest";

import { buildLevel as phLevel, dirtCount, CHAPTERS as PH_CHAPTERS } from "./poop-hero/levels";
import { LEVELS as TUG, CHAPTERS as TUG_CHAPTERS } from "./red-blue-tug/levels";
import { questionCount, levelTimeLimitMs, kindPool, CHAPTERS as QZ_CHAPTERS } from "./pinyin-train/levels";
import { LEVELS as FDF, CHAPTERS as FDF_CHAPTERS } from "./find-diff/levels";
import { LEVELS as KTC, CHAPTERS as KTC_CHAPTERS } from "./kitty-care/levels";

const TOTAL = 188;

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

function ranges(chapters: ReadonlyArray<{ size: number }>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let at = 0;
  for (const c of chapters) {
    if (at >= TOTAL) break;
    out.push([at, Math.min(at + c.size, TOTAL)]);
    at += c.size;
  }
  return out;
}

/**
 * 屎壳郎清洁工：要清的脏东西越多越难；会跑的豆豆怪比不动的污渍难；
 * 坑 / 浮台 / 光束 / 垃圾分类 / 推车各是一层额外操作；路越长越费体力。
 * 最后除以「每件脏东西摊到几秒」——时间给得越宽，同样的活就越轻。
 */
function phIndex(lv: number): number {
  const d = phLevel(lv);
  const work =
    dirtCount(d) +
    d.monsters.length * 0.6 +
    d.gaps.length * 1.4 +
    d.platforms.length * 0.8 +
    (d.beams?.length ?? 0) * 1.2 +
    (d.junks?.length ?? 0) * 1.6 +
    (d.cart ? 3 : 0) +
    d.len / 900;
  return (work * 10) / Math.max(2, d.timeLimit / Math.max(1, dirtCount(d)));
}

/** 红蓝拔河：小电脑每秒拉走多少 ÷ 你一下拉回多少，再叠红灯、交替手、读招、体力、补给 */
function tugIndex(lv: number): number {
  const t = TUG[lv];
  return (
    t.aiRate / t.pullPower +
    (t.redlight ? 0.5 : 0) +
    (t.rhythm ? 0.4 : 0) +
    (t.aiAdapt ?? 0) * 1.5 +
    (t.stamina ? Math.max(0, (30 - t.stamina) / 12) : 0) +
    (t.supply ? 0.2 : 0)
  );
}

/** 拼音小火车：题量 × 题型分量；限时的再乘一个「每题摊到几秒」的紧张系数 */
const QZ_KIND_WEIGHT: Record<string, number> = {
  vowel: 1, match: 1.1, tone: 1.3, whole: 1.4, confuse: 1.6, tonemark: 1.7,
  neutral: 1.8, erhua: 1.9, duoyin: 2.1, context: 2.2, sentence: 2.3,
};
function qzIndex(lv0: number): number {
  const lv = lv0 + 1;
  const n = questionCount(lv);
  const limit = levelTimeLimitMs(lv) / 1000;
  const rush = limit > 0 ? Math.max(1, 1 + (25 - limit / n) / 25) : 1;
  return n * mean(kindPool(lv).map((k) => QZ_KIND_WEIGHT[k] ?? 1.5)) * rush;
}

/** 找不同：几格里藏几处（越稀越难扫），乘双胞胎 / 干扰图 / 会动 / 镜像 / 连环，再除每处给几秒 */
function fdfIndex(lv: number): number {
  const L = FDF[lv];
  const hunt = (L.rows * L.cols) / Math.max(1, L.diffs);
  const modeW =
    (L.lookalike ? 1.35 : 1) *
    (L.decoys ? 1 + L.decoys * 0.08 : 1) *
    (L.moveEverySec ? 1 + 3 / L.moveEverySec : 1) *
    (L.mode === "mirror" ? 1.25 : 1) *
    (L.rounds > 1 ? 1 + (L.rounds - 1) * 0.22 : 1);
  const perDiff = L.timeSec > 0 ? L.timeSec / (L.diffs * L.rounds) : 40;
  return (hunt * modeW * 10) / Math.max(4, perDiff);
}

/** 萌猫小屋：几件事 × 每件事的分量 + 手上的操作量 + 要动脑子挑的（看病 / 搭配）+ 同屋几只猫 */
const KTC_TASK_WEIGHT: Record<string, number> = {
  feed: 1, play: 1.1, wash: 1.2, sleep: 1.1, dress: 1.3, cure: 1.9, style: 1.8,
};
function ktcIndex(lv: number): number {
  const L = KTC[lv];
  return (
    L.tasks.reduce((a, t) => a + (KTC_TASK_WEIGHT[t] ?? 1.2), 0) +
    (L.playTaps + L.washSpots + L.notes) / 12 +
    (L.options - 2) * 0.5 +
    (L.cureSteps ?? 0) * 0.5 +
    (L.styleSlots ?? 0) * 0.5 +
    ((L.cats ?? 1) - 1) * 1.2
  );
}

const GAMES = [
  { name: "屎壳郎清洁工", chapters: PH_CHAPTERS, index: phIndex },
  { name: "红蓝拔河", chapters: TUG_CHAPTERS, index: tugIndex },
  { name: "拼音小火车", chapters: QZ_CHAPTERS, index: qzIndex },
  { name: "找不同", chapters: FDF_CHAPTERS, index: fdfIndex },
  { name: "萌猫小屋", chapters: KTC_CHAPTERS, index: ktcIndex },
];

describe("窗口5 第3轮 档C · 五款 188 关的难度曲线", () => {
  it.each(GAMES)("$name：每一章章内都在加码", ({ chapters, index }) => {
    const all = Array.from({ length: TOTAL }, (_, lv) => index(lv));
    const rr = ranges(chapters);
    expect(rr.length).toBeGreaterThanOrEqual(6);
    rr.forEach(([a, b], ci) => {
      const seg = all.slice(a, b);
      const third = Math.max(2, Math.floor(seg.length / 3));
      const head = mean(seg.slice(0, third));
      const tail = mean(seg.slice(-third));
      expect(
        tail / head,
        `第 ${ci + 1} 章（第 ${a + 1}–${b} 关）章内没加码：前三分之一 ${head.toFixed(2)}，后三分之一 ${tail.toFixed(2)}`
      ).toBeGreaterThan(1.05);
    });
  });

  it.each(GAMES)("$name：开新章可以回落教学，但不许跌穿", ({ chapters, index }) => {
    const all = Array.from({ length: TOTAL }, (_, lv) => index(lv));
    const means = ranges(chapters).map(([a, b]) => mean(all.slice(a, b)));
    for (let i = 1; i < means.length; i++) {
      expect(
        means[i] / means[i - 1],
        `第 ${i + 1} 章的平均难度 ${means[i].toFixed(2)} 只有第 ${i} 章 ${means[i - 1].toFixed(2)} 的 ${(means[i] / means[i - 1]).toFixed(2)} 倍，回落太狠`
      ).toBeGreaterThan(0.35);
    }
  });

  it.each(GAMES)("$name：整条曲线是涨的，末 5 关至少是首 5 关的 1.8 倍", ({ index }) => {
    const all = Array.from({ length: TOTAL }, (_, lv) => index(lv));
    const head = mean(all.slice(0, 5));
    const tail = mean(all.slice(-5));
    expect(tail / head, `首 5 关 ${head.toFixed(2)}，末 5 关 ${tail.toFixed(2)}，曲线太平`).toBeGreaterThan(1.8);
  });

  it.each(GAMES)("$name：章内没有断崖（9 关滑动窗口）", ({ chapters, index }) => {
    const all = Array.from({ length: TOTAL }, (_, lv) => index(lv));
    const win = all.map((_, i) => mean(all.slice(Math.max(0, i - 4), i + 5)));
    for (const [a, b] of ranges(chapters)) {
      const cap = mean(all.slice(a, b)) / 2;
      for (let lv = a + 1; lv < b; lv++) {
        expect(
          Math.abs(win[lv] - win[lv - 1]),
          `第 ${lv + 1} 关一带是断崖：滑窗从 ${win[lv - 1].toFixed(2)} 跳到 ${win[lv].toFixed(2)}`
        ).toBeLessThanOrEqual(cap);
      }
    }
  });
});
