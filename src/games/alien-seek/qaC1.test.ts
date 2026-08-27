// 窗口 4 · QA 档C · 第 1 轮测试员:寻找外星朋友。
//
// 这一份不重复既有单测已经覆盖的点(布局校验、缩放、望远镜),
// 只按第 1 轮剧本走一遍真实链路:
//   首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 → 无尽 / 对战 / 双人各玩到结算 → 360px。
//
// 「赢」「输」都不是看函数返回值,而是拿 hitSpot 一个一个真的点、按 travelTime 真的走位、
// 时间不够就判输 —— 和玩家在屏幕上做的事一致。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, totalSize } from "../level99";
import { meta } from "./meta";
import {
  CHAPTERS,
  DEDUCE_LEVELS,
  LEVELS,
  buildEndlessRound,
  buildLevel,
  buildVersusRound,
  isDeduceLevel,
  type DeduceLevel,
  type FindLevel,
  type SeekLevel,
} from "./levels";
import {
  clueText,
  deduceStars,
  endlessLine,
  findStars,
  formatClock,
  hitSpot,
  missPenalty,
  solveDeduction,
  travelTime,
  versusLine,
  versusWinner,
} from "./logic";
import { REACT_SEC, START_X, START_Y, levelIsBeatable, solveLevel } from "./sim";
import { MIN_TARGET_PX, PHONE_WIDTH, emptyClickTip, layoutIssues, screenDiameter } from "./seek12";

/* ------------------------------------------------------------------ */
/* 一个不碰 DOM 的「真人玩一关」                                        */
/* ------------------------------------------------------------------ */

interface PlayLog {
  won: boolean;
  secondsLeft: number;
  misses: number;
  /** 按顺序点中的藏身点下标 */
  clicked: number[];
}

/**
 * 找物关:光标从出生点出发,每次走向最近的那个还没找到的目标,
 * 走到了就真的调一次 hitSpot 点下去。时间用完还没找齐就算输。
 */
function playFind(lv: FindLevel, opts: { jitter?: number; stopAfter?: number } = {}): PlayLog {
  const jitter = opts.jitter ?? 0;
  const todo = lv.targets.map((t) => t.spot);
  const clicked: number[] = [];
  let x = START_X;
  let y = START_Y;
  let left = lv.seconds;
  let misses = 0;
  const budget = opts.stopAfter ?? Infinity;

  while (todo.length > 0 && clicked.length < budget) {
    let bestK = 0;
    let bestT = Infinity;
    for (let k = 0; k < todo.length; k++) {
      const s = lv.spots[todo[k]];
      const t = travelTime(x, y, s.x, s.y);
      if (t < bestT) {
        bestT = t;
        bestK = k;
      }
    }
    const idx = todo.splice(bestK, 1)[0];
    const s = lv.spots[idx];
    left -= bestT + REACT_SEC;
    if (left <= 0) return { won: false, secondsLeft: 0, misses, clicked };
    // 手指不会正好点在圆心上,偏一点也必须点得中
    const hit = hitSpot(lv.spots, s.x + jitter, s.y + jitter);
    if (hit === idx) {
      clicked.push(idx);
      x = s.x;
      y = s.y;
    } else {
      misses++;
      left -= missPenalty(lv.chapter);
    }
  }

  return {
    won: clicked.length === lv.targets.length,
    secondsLeft: Math.max(0, Math.round(left * 100) / 100),
    misses,
    clicked,
  };
}

/** 推理关:读完全部线索(每条按 sim 的 4 秒算),再点唯一那个答案 */
function playDeduce(lv: DeduceLevel, pickWrongFirst = 0): PlayLog {
  const sol = solveDeduction(lv.spots, lv.clues);
  let left = lv.seconds - lv.clues.length * 4;
  let wrong = 0;
  const clicked: number[] = [];
  const wrongPool = lv.spots.map((_, i) => i).filter((i) => i !== lv.answer);

  for (let k = 0; k < pickWrongFirst && k < wrongPool.length; k++) {
    const s = lv.spots[wrongPool[k]];
    left -= travelTime(START_X, START_Y, s.x, s.y) + REACT_SEC + missPenalty(lv.chapter);
    wrong++;
  }
  const a = lv.spots[lv.answer];
  left -= travelTime(START_X, START_Y, a.x, a.y) + REACT_SEC;
  if (left > 0 && sol.length === 1 && sol[0] === lv.answer) clicked.push(lv.answer);

  return {
    won: clicked.length === 1,
    secondsLeft: Math.max(0, Math.round(left * 100) / 100),
    misses: wrong,
    clicked,
  };
}

const FIND_L1 = LEVELS.find((l): l is FindLevel => l.mode === "find")!;
/** 第一关只有一个目标,验「半途而废」要拿一关多目标的 */
const FIND_MULTI = LEVELS.find(
  (l): l is FindLevel => l.mode === "find" && l.targets.length >= 3
)!;

/* ------------------------------------------------------------------ */
/* 一、从首页进得去                                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · alien-seek · 首页进入", () => {
  it("meta 的 id / 关数 / 分类和实现完全对得上", () => {
    expect(meta.id).toBe("alien-seek");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect(meta.category).toBe("casual");
    expect(meta.platform).toBe("both");
    expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("meta.modes 声明的四种模式都有真实入口,没有画大饼", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(buildLevel(0).spots.length).toBeGreaterThan(0);
    expect(buildEndlessRound(1).spots.length).toBeGreaterThan(0);
    expect(buildVersusRound(1).targets.length).toBeGreaterThan(0);
    // 双人同屏:对战场的提示里两套键位都写清楚了
    expect(buildVersusRound(1).hint).toContain("W A S D");
    expect(buildVersusRound(1).hint).toContain("方向键");
  });

  it("八章的名字、描述、配色都齐,进首页不会出现空卡片", () => {
    expect(CHAPTERS).toHaveLength(8);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.emoji.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、赢一次 + 输一次                                                  */
/* ------------------------------------------------------------------ */

describe("档C R1 · alien-seek · 赢一次 + 输一次", () => {
  it("赢:第 1 关按最慢的键盘走位也能把全部目标点出来,还剩时间", () => {
    const log = playFind(FIND_L1);
    expect(log.won).toBe(true);
    expect(log.clicked).toHaveLength(FIND_L1.targets.length);
    expect(log.misses).toBe(0);
    expect(log.secondsLeft).toBeGreaterThan(0);
    expect(findStars(log.secondsLeft, FIND_L1.seconds, log.misses)).toBeGreaterThanOrEqual(1);
  });

  it("赢:手指偏 12px 也照样点得中,不用戳圆心", () => {
    const log = playFind(FIND_L1, { jitter: 12 });
    expect(log.won).toBe(true);
    expect(log.misses).toBe(0);
  });

  it("输:只点了一半就撒手,这一关判没过,而且一颗星都不倒扣", () => {
    expect(FIND_MULTI.targets.length).toBeGreaterThanOrEqual(3);
    const log = playFind(FIND_MULTI, { stopAfter: FIND_MULTI.targets.length - 1 });
    expect(log.won).toBe(false);
    expect(log.clicked.length).toBeLessThan(FIND_MULTI.targets.length);
    // 点空只给提示,不扣星:失败页面上仍然是鼓励
    expect(emptyClickTip(3)).toBeTruthy();
    expect(/笨|不行|差劲|失败/.test(emptyClickTip(3) ?? "")).toBe(false);
  });

  it("输:限时一到就该收场,formatClock 一路数到 0:00 不出现负数", () => {
    for (const s of [37.4, 5, 0.2, 0, -3]) {
      const text = formatClock(s);
      expect(text).toMatch(/^\d+:\d{2}$/);
      expect(text.startsWith("-")).toBe(false);
    }
    expect(formatClock(0)).toBe("0:00");
  });

  it("推理关:点唯一那个答案就赢,三星;先点错两下只掉到一星,不会直接判负", () => {
    const lv = DEDUCE_LEVELS[0];
    const clean = playDeduce(lv, 0);
    expect(clean.won).toBe(true);
    expect(deduceStars(clean.misses, clean.secondsLeft)).toBe(3);

    const messy = playDeduce(lv, 2);
    expect(messy.misses).toBe(2);
    expect(deduceStars(messy.misses, messy.secondsLeft)).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* 三、战役第 1 / 100 / 188 关                                          */
/* ------------------------------------------------------------------ */

describe("档C R1 · alien-seek · 战役第 1 / 100 / 188 关", () => {
  const PICKS = [1, 100, 188];

  it.each(PICKS)("第 %i 关能进、限时够、目标点得中", (n) => {
    const lv: SeekLevel = buildLevel(n - 1);
    expect(lv.index).toBe(n - 1);
    expect(layoutIssues(lv.spots)).toEqual([]);
    expect(levelIsBeatable(lv), `第 ${n} 关限时不够:${JSON.stringify(solveLevel(lv))}`).toBe(true);

    if (lv.mode === "find") {
      const log = playFind(lv);
      expect(log.won, `第 ${n} 关按最慢玩法没打完`).toBe(true);
    } else {
      const log = playDeduce(lv);
      expect(log.won, `第 ${n} 关推理没解出来`).toBe(true);
      expect(solveDeduction(lv.spots, lv.clues)).toEqual([lv.answer]);
    }
  });

  it("同一关重进两次,布局与答案完全一样(确定性,不会「上次那关不见了」)", () => {
    for (const n of PICKS) {
      expect(JSON.stringify(buildLevel(n - 1))).toBe(JSON.stringify(buildLevel(n - 1)));
    }
  });

  it("第 188 关是最后一关,再往后要不到新关卡", () => {
    expect(buildLevel(188).index).toBe(187);
    expect(buildLevel(9999).index).toBe(187);
    expect(buildLevel(-5).index).toBe(0);
  });

  it("推理关只从第 6 章起出现,前五章一道都没有(难度台阶按设计走)", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      if (lv < 115) expect(isDeduceLevel(lv), `第 ${lv + 1} 关不该是推理关`).toBe(false);
    }
    expect(DEDUCE_LEVELS.length).toBeGreaterThan(20);
  });

  it("每一道推理关的线索都读得成中文,不会漏出内部字段名", () => {
    for (const lv of DEDUCE_LEVELS.slice(0, 12)) {
      for (const c of lv.clues) {
        const text = clueText(c, lv.spots);
        expect(text.length).toBeGreaterThan(4);
        expect(text).not.toMatch(/undefined|NaN|\[object/);
        expect(text.endsWith("。")).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 四、无尽 / 对战 / 双人各玩到结算                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · alien-seek · 无尽玩到结算", () => {
  it("连打 15 轮每轮都真的赢得下来,一路走到结算不卡死", () => {
    let round = 0;
    for (let r = 1; r <= 15; r++) {
      const lv = buildEndlessRound(r);
      expect(layoutIssues(lv.spots), `第 ${r} 轮布局不合格`).toEqual([]);
      const log = lv.mode === "find" ? playFind(lv) : playDeduce(lv);
      expect(log.won, `第 ${r} 轮没打过`).toBe(true);
      round = r;
    }
    expect(round).toBe(15);
    expect(endlessLine(round, 3)).toContain("新纪录");
    expect(endlessLine(round, 40)).toContain("最好成绩");
  });

  it("结算文案只鼓励,一句损人的话都没有", () => {
    for (const line of [endlessLine(1, 1), endlessLine(0, 9), endlessLine(30, 2)]) {
      for (const bad of ["失败", "笨", "差劲", "输了"]) expect(line).not.toContain(bad);
    }
  });
});

describe("档C R1 · alien-seek · 对战 / 双人玩到结算", () => {
  it("两个光标各抢各的,六局都能分出结果并走到结算", () => {
    for (let r = 1; r <= 6; r++) {
      const lv = buildVersusRound(r);
      // 朵朵从左边出发、星星从右边出发:各自去抢离自己更近的那些目标
      let a = 0;
      let b = 0;
      for (const t of lv.targets) {
        const s = lv.spots[t.spot];
        if (travelTime(200, 320, s.x, s.y) <= travelTime(800, 320, s.x, s.y)) a++;
        else b++;
      }
      expect(a + b).toBe(lv.targets.length);
      const who = versusWinner(a, b);
      expect(["朵朵", "星星", "平局"]).toContain(who);
      const line = versusLine(a, b);
      expect(line.length).toBeGreaterThan(6);
      expect(/笨|差劲|输了/.test(line)).toBe(false);
    }
  });

  it("双人局的目标数一定是单数,不会出现「各拿一半」的死平局", () => {
    for (let r = 1; r <= 12; r++) {
      expect(buildVersusRound(r).targets.length % 2, `第 ${r} 局目标数是双数`).toBe(1);
    }
  });

  it("平局也有一句好话,分数不会串台", () => {
    expect(versusWinner(3, 3)).toBe("平局");
    expect(versusLine(3, 3)).toContain("平手");
    expect(versusLine(5, 2)).toContain("朵朵");
    expect(versusLine(2, 5)).toContain("星星");
  });
});

/* ------------------------------------------------------------------ */
/* 五、360px 窄屏                                                       */
/* ------------------------------------------------------------------ */

describe("档C R1 · alien-seek · 360px 窄屏", () => {
  it("无尽轮的目标在 360px 上照样点得动(既有单测只盖了战役)", () => {
    for (let r = 1; r <= 30; r++) {
      for (const s of buildEndlessRound(r).spots) {
        expect(screenDiameter(s, PHONE_WIDTH), `第 ${r} 轮有目标太小`).toBeGreaterThanOrEqual(
          MIN_TARGET_PX
        );
      }
    }
  });

  it("对战场的目标在 360px 上也够大,双人挤一屏不会互相点错", () => {
    for (let r = 1; r <= 20; r++) {
      for (const s of buildVersusRound(r).spots) {
        expect(screenDiameter(s, PHONE_WIDTH)).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      }
    }
  });
});
