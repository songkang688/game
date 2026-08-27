// 对局层纯逻辑的回归：落子确认、提示限次、连胜阶梯、level→AI 档、
// 直开第 N 题、旧存档迁移。全是纯函数，不需要 DOM。
import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "./ai";
import { TOTAL_LEVELS, loadStars, saveStar, type StorageLike } from "../level99";
import {
  HINTS_PER_FREE_GAME,
  HINTS_PER_PUZZLE,
  LEGACY_CAMPAIGN_KEY,
  STREAK_LADDER,
  TIER_SHORT,
  areaContains,
  areaWords,
  brokeRecord,
  difficultyForLevel,
  emptyConfirm,
  hintArea,
  hintButtonHint,
  hintSpentLine,
  initialLevelOf,
  migrateLegacyCampaign,
  newHints,
  newStreak,
  parseLegacyStars,
  prefersConfirm,
  puzzleOfLevel,
  puzzleStars,
  spendHint,
  streakDifficulty,
  streakLine,
  streakOpening,
  streakRecordLine,
  streakStep,
  streakWinTitle,
  tapCell,
} from "./session";

function memStore(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("落子确认 · 默认值", () => {
  it("触屏（粗指针）默认开", () => {
    expect(prefersConfirm({ coarsePointer: true })).toBe(true);
  });

  it("桌面（细指针）默认关", () => {
    expect(prefersConfirm({ coarsePointer: false, cellPx: 40 })).toBe(false);
  });

  it("拿不到指针信息时，看得出是手机的多点触控也算手机", () => {
    expect(prefersConfirm({ maxTouchPoints: 5 })).toBe(true);
    expect(prefersConfirm({ maxTouchPoints: 0 })).toBe(false);
  });

  it("什么都拿不到就退回「格子够不够大」：窄屏 21px 一格要确认", () => {
    expect(prefersConfirm({ cellPx: 21 })).toBe(true);
    expect(prefersConfirm({ cellPx: 34 })).toBe(false);
    expect(prefersConfirm({})).toBe(false);
  });
});

describe("落子确认 · 状态机", () => {
  const on = { confirm: true, myTurn: true, occupied: false };

  it("关着确认时，点一下就落子", () => {
    const r = tapCell(emptyConfirm(), { x: 3, y: 4 }, { ...on, confirm: false });
    expect(r.kind).toBe("commit");
    expect(r.cell).toEqual({ x: 3, y: 4 });
    expect(r.state.pending).toBeNull();
  });

  it("开着确认时，第一次点只是预览", () => {
    const r = tapCell(emptyConfirm(), { x: 3, y: 4 }, on);
    expect(r.kind).toBe("preview");
    expect(r.state.pending).toEqual({ x: 3, y: 4 });
  });

  it("同一个点再点一次才真的落子，落完待确认清空", () => {
    const first = tapCell(emptyConfirm(), { x: 3, y: 4 }, on);
    const second = tapCell(first.state, { x: 3, y: 4 }, on);
    expect(second.kind).toBe("commit");
    expect(second.cell).toEqual({ x: 3, y: 4 });
    expect(second.state.pending).toBeNull();
  });

  it("点到别处只是换预览点，不会误落子", () => {
    const first = tapCell(emptyConfirm(), { x: 3, y: 4 }, on);
    const moved = tapCell(first.state, { x: 8, y: 1 }, on);
    expect(moved.kind).toBe("move");
    expect(moved.state.pending).toEqual({ x: 8, y: 1 });
    const commit = tapCell(moved.state, { x: 8, y: 1 }, on);
    expect(commit.kind).toBe("commit");
    expect(commit.cell).toEqual({ x: 8, y: 1 });
  });

  it("点到已经有子的格子：取消待确认，什么也不落", () => {
    const first = tapCell(emptyConfirm(), { x: 3, y: 4 }, on);
    const r = tapCell(first.state, { x: 5, y: 5 }, { ...on, occupied: true });
    expect(r.kind).toBe("clear");
    expect(r.cell).toBeNull();
    expect(r.state.pending).toBeNull();
  });

  it("不该我下的时候点棋盘完全没反应，待确认也不动", () => {
    const first = tapCell(emptyConfirm(), { x: 3, y: 4 }, on);
    const r = tapCell(first.state, { x: 6, y: 6 }, { ...on, myTurn: false });
    expect(r.kind).toBe("ignore");
    expect(r.state.pending).toEqual({ x: 3, y: 4 });
  });
});

describe("提示限次", () => {
  it("自由对战每局 3 次、解局每题 1 次", () => {
    expect(newHints("free").left).toBe(HINTS_PER_FREE_GAME);
    expect(newHints("free").left).toBe(3);
    expect(newHints("puzzle").left).toBe(HINTS_PER_PUZZLE);
    expect(newHints("puzzle").left).toBe(1);
  });

  it("自由对战用满 3 次后第 4 次要不到", () => {
    let s = newHints("free");
    for (let i = 0; i < 3; i++) {
      const r = spendHint(s);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    expect(s.left).toBe(0);
    expect(s.used).toBe(3);
    const extra = spendHint(s);
    expect(extra.ok).toBe(false);
    expect(extra.state.used).toBe(3);
  });

  it("解局用掉那一次就没有三星了", () => {
    const r = spendHint(newHints("puzzle"));
    expect(r.ok).toBe(true);
    expect(spendHint(r.state).ok).toBe(false);
    expect(puzzleStars(false)).toBe(3);
    expect(puzzleStars(true)).toBe(2);
  });
});

describe("提示文案分级", () => {
  it("解局在点下去之前就说清「用了最多 2 星」", () => {
    const fresh = newHints("puzzle");
    expect(hintButtonHint(fresh, "puzzle")).toContain("2 星");
    // 自由对战不掉星，就别吓唬人
    expect(hintButtonHint(newHints("free"), "free")).not.toContain("星");
  });

  it("自由对战剩最后一次会单独说一句", () => {
    let s = newHints("free");
    expect(hintButtonHint(s, "free")).toContain("3 次");
    s = spendHint(s).state;
    s = spendHint(s).state;
    expect(s.left).toBe(1);
    expect(hintButtonHint(s, "free")).toContain("最后 1 次");
  });

  it("用完了也有话说，不只剩一个灰按钮", () => {
    const empty = { left: 0, used: 3 };
    expect(hintButtonHint(empty, "free")).toContain("用完");
    expect(hintButtonHint({ left: 0, used: 1 }, "puzzle")).toContain("用完");
  });

  it("真的用掉一次之后，区域文案后面接上还剩几次", () => {
    const area = hintArea({ x: 4, y: 4 }, 9, 1, () => 0);
    const twoLeft = hintSpentLine(area, { left: 2, used: 1 }, "free");
    expect(twoLeft.startsWith(area.text)).toBe(true);
    expect(twoLeft).toContain("还剩 2 次");
    const last = hintSpentLine(area, { left: 0, used: 3 }, "free");
    expect(last).toContain("最后一次");
    const puzzle = hintSpentLine(area, { left: 0, used: 1 }, "puzzle");
    expect(puzzle).toContain("2 星");
  });

  it("补出来的这几句仍旧一个行列号都不报", () => {
    const area = hintArea({ x: 1, y: 7 }, 15, 1, () => 0);
    // 只允许出现「次数 / 星数」这类计数，不许出现坐标形式的 (x, y)
    for (const line of [
      hintSpentLine(area, { left: 2, used: 1 }, "free"),
      hintSpentLine(area, { left: 0, used: 1 }, "puzzle"),
    ]) {
      expect(line).not.toMatch(/[（(]\s*\d+\s*[,，]\s*\d+\s*[)）]/);
      expect(line.startsWith(area.text)).toBe(true);
    }
  });
});

describe("提示只给区域，不报坐标", () => {
  it("圈出的是 3×3 一片，而且一定包含正解", () => {
    for (let x = 0; x < 9; x++) {
      for (let y = 0; y < 9; y++) {
        for (const r of [0, 0.4, 0.99]) {
          const a = hintArea({ x, y }, 9, 1, () => r);
          expect(areaContains(a, x, y)).toBe(true);
          expect(a.x1 - a.x0).toBe(2);
          expect(a.y1 - a.y0).toBe(2);
          expect(a.x0).toBeGreaterThanOrEqual(0);
          expect(a.y1).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it("亮区中心不总是正解：随机偏移会把答案挪到角上", () => {
    const centered = hintArea({ x: 4, y: 4 }, 9, 1, () => 0.99);
    const shifted = hintArea({ x: 4, y: 4 }, 9, 1, () => 0);
    expect([centered.x0, shifted.x0]).not.toEqual([centered.x0, centered.x0]);
    expect(shifted.x0).not.toBe(centered.x0);
  });

  it("提示语只说方位，一个行列号都不给", () => {
    const a = hintArea({ x: 1, y: 7 }, 15, 1, () => 0);
    expect(a.text).not.toMatch(/\d/);
    expect(a.text).toContain("棋盘");
    expect(areaWords(7, 7, 15)).toBe("棋盘正中间");
    expect(areaWords(0, 0, 15)).toContain("上边");
    expect(areaWords(14, 14, 15)).toContain("下边");
  });

  it("正解贴在棋盘角上时亮区自动往里收，不会溢出棋盘", () => {
    const a = hintArea({ x: 0, y: 0 }, 9, 1, () => 0);
    expect(a.x0).toBe(0);
    expect(a.y0).toBe(0);
    expect(areaContains(a, 0, 0)).toBe(true);
    const b = hintArea({ x: 8, y: 8 }, 9, 1, () => 0.99);
    expect(b.x1).toBe(8);
    expect(b.y1).toBe(8);
    expect(areaContains(b, 8, 8)).toBe(true);
  });
});

describe("连胜挑战", () => {
  it("阶梯就是六档，从菜鸟起", () => {
    expect(STREAK_LADDER).toEqual(DIFFICULTIES);
    expect(streakDifficulty(0)).toBe("novice");
    expect(streakDifficulty(1)).toBe("easy");
    expect(streakDifficulty(5)).toBe("hell");
  });

  it("赢一盘升一档，到地狱就封顶", () => {
    expect(streakDifficulty(6)).toBe("hell");
    expect(streakDifficulty(99)).toBe("hell");
    expect(streakDifficulty(-3)).toBe("novice");
  });

  it("连赢 4 盘的计分与档位", () => {
    let s = newStreak();
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(streakDifficulty(s.wins));
      s = streakStep(s, "win");
    }
    expect(seen).toEqual(["novice", "easy", "normal", "smart"]);
    expect(s.wins).toBe(4);
    expect(s.best).toBe(4);
    expect(s.over).toBe(false);
  });

  it("输一盘这一轮就结束，最高连胜留着", () => {
    let s = newStreak();
    s = streakStep(s, "win");
    s = streakStep(s, "win");
    s = streakStep(s, "loss");
    expect(s.over).toBe(true);
    expect(s.wins).toBe(2);
    expect(s.best).toBe(2);
    // 结束之后再报成绩不会改分
    expect(streakStep(s, "win").wins).toBe(2);
  });

  it("和棋不升档也收摊，不能靠和棋刷连胜", () => {
    const s = streakStep(streakStep(newStreak(), "win"), "draw");
    expect(s.over).toBe(true);
    expect(s.wins).toBe(1);
  });

  it("历史最好成绩带进来，新一轮打不过它就不动", () => {
    let s = newStreak(7);
    s = streakStep(s, "win");
    expect(s.best).toBe(7);
    expect(streakLine(s)).toContain("下一位是");
    s = streakStep(s, "loss");
    expect(streakLine(s)).toContain("最高纪录 7 盘");
  });

  it("六档短名齐全", () => {
    for (const d of DIFFICULTIES) expect(TIER_SHORT[d].length).toBeGreaterThan(0);
  });
});

describe("连胜 · 破纪录反馈", () => {
  it("第一次玩没有纪录，就不多说一句纪录的话", () => {
    let s = newStreak(0);
    expect(streakRecordLine(s)).toBe("");
    expect(streakOpening(s)).toBe(streakLine(s));
    s = streakStep(s, "win");
    expect(streakRecordLine(s)).toContain("最高纪录 1 盘");
  });

  it("整轮都看得见离纪录还差几盘", () => {
    let s = newStreak(5);
    expect(streakRecordLine(s)).toContain("还差 5 盘");
    s = streakStep(s, "win");
    s = streakStep(s, "win");
    s = streakStep(s, "win");
    expect(streakRecordLine(s)).toContain("还差 2 盘");
    s = streakStep(s, "win");
    // 只差一盘时换一句更催人的说法，不再报「还差 1 盘」
    expect(streakRecordLine(s)).toContain("再赢 1 盘");
    expect(streakRecordLine(s)).not.toContain("还差");
    s = streakStep(s, "win");
    expect(s.wins).toBe(5);
    expect(streakRecordLine(s)).toContain("已经是最高纪录");
  });

  it("开局播报 = 连胜播报 + 纪录播报", () => {
    const s = streakStep(newStreak(4), "win");
    const opening = streakOpening(s);
    expect(opening.startsWith(streakLine(s))).toBe(true);
    expect(opening).toContain(streakRecordLine(s));
  });

  it("超过旧纪录那一盘才算刷新纪录，追平不算", () => {
    let s = newStreak(2);
    let prev = s.best;
    s = streakStep(s, "win");
    expect(brokeRecord(prev, s)).toBe(false);
    prev = s.best;
    s = streakStep(s, "win");
    // 第 2 盘只是追平旧纪录 2 盘
    expect(s.wins).toBe(2);
    expect(brokeRecord(prev, s)).toBe(false);
    prev = s.best;
    s = streakStep(s, "win");
    expect(brokeRecord(prev, s)).toBe(true);
  });

  it("第一次玩不报「新纪录」，破了纪录的标题才换样子", () => {
    const first = streakStep(newStreak(0), "win");
    expect(brokeRecord(0, first)).toBe(false);
    expect(streakWinTitle(0, first)).toContain("连赢 1 盘");
    const s = streakStep(streakStep(streakStep(newStreak(2), "win"), "win"), "win");
    expect(streakWinTitle(2, s)).toContain("新纪录 3 盘");
    expect(streakWinTitle(9, s)).toContain("连赢 3 盘");
  });

  it("坏数字当没有纪录处理", () => {
    const s = streakStep(newStreak(0), "win");
    expect(brokeRecord(Number.NaN, s)).toBe(false);
    expect(brokeRecord(-4, s)).toBe(false);
  });
});

describe("自由对战 level → AI 档", () => {
  it("六档均分 188 关，关号越大对手越强", () => {
    const seen = [0, 30, 60, 90, 120, 150, 187].map(difficultyForLevel);
    expect(seen).toEqual(["novice", "easy", "normal", "smart", "master", "hell", "hell"]);
  });

  it("档位随关号单调不降", () => {
    let prev = -1;
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const idx = STREAK_LADDER.indexOf(difficultyForLevel(lv));
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
    expect(prev).toBe(STREAK_LADDER.length - 1);
  });

  it("越界的关号 clamp 到首尾档", () => {
    expect(difficultyForLevel(-5)).toBe("novice");
    expect(difficultyForLevel(9999)).toBe("hell");
    expect(difficultyForLevel(Number.NaN)).toBe("novice");
  });
});

describe("直开第 N 题", () => {
  it("壳层给的是 1 基关号，转成 0 基下标", () => {
    expect(initialLevelOf(1)).toBe(0);
    expect(initialLevelOf(100)).toBe(99);
    expect(initialLevelOf(188)).toBe(187);
  });

  it("地址栏 ?level=N 也认", () => {
    expect(initialLevelOf(undefined, "?level=42")).toBe(41);
    expect(initialLevelOf(undefined, "?from=home&level=7")).toBe(6);
  });

  it("hash 里的关号也认", () => {
    expect(initialLevelOf(undefined, "", "#/gomoku?level=12")).toBe(11);
    expect(initialLevelOf(undefined, "", "#/gomoku/12")).toBe(11);
  });

  it("给不出关号就返回 -1，照常回选关地图", () => {
    expect(initialLevelOf(undefined)).toBe(-1);
    expect(initialLevelOf(null, "?x=1", "#home")).toBe(-1);
    expect(initialLevelOf("abc")).toBe(-1);
  });

  it("越界一律 clamp 在 0..187", () => {
    expect(initialLevelOf(0)).toBe(0);
    expect(initialLevelOf(-9)).toBe(0);
    expect(initialLevelOf(9999)).toBe(TOTAL_LEVELS - 1);
    expect(initialLevelOf(undefined, "?level=9999")).toBe(TOTAL_LEVELS - 1);
  });

  it("关号映射到残局下标也不会越界", () => {
    expect(puzzleOfLevel(0)).toBe(0);
    expect(puzzleOfLevel(187)).toBe(187);
    expect(puzzleOfLevel(500)).toBe(187);
    expect(puzzleOfLevel(-1)).toBe(0);
  });
});

describe("旧战役存档迁移（一颗星都不能丢）", () => {
  it("旧 key 里的 188 星全部搬进框架存档，然后旧 key 被删掉", () => {
    const legacy = new Array<number>(TOTAL_LEVELS).fill(0);
    legacy[0] = 3;
    legacy[5] = 2;
    legacy[98] = 3;
    legacy[187] = 1;
    const store = memStore({ [LEGACY_CAMPAIGN_KEY]: JSON.stringify({ stars: legacy }) });

    const r = migrateLegacyCampaign(store, "gomoku-mig1");
    expect(r.migrated).toBe(true);
    expect(r.moved).toBe(4);
    expect(r.stars[0]).toBe(3);
    expect(r.stars[5]).toBe(2);
    expect(r.stars[98]).toBe(3);
    expect(r.stars[187]).toBe(1);
    expect(store.getItem(LEGACY_CAMPAIGN_KEY)).toBeNull();
    expect(loadStars("gomoku-mig1", store)[98]).toBe(3);
  });

  it("1.0 存的长度 99 数组：前 99 位原样保留，后面补 0", () => {
    const legacy = new Array<number>(99).fill(1);
    legacy[3] = 3;
    const store = memStore({ [LEGACY_CAMPAIGN_KEY]: JSON.stringify({ stars: legacy }) });
    const r = migrateLegacyCampaign(store, "gomoku-mig2");
    expect(r.stars.slice(0, 99).every((s) => s >= 1)).toBe(true);
    expect(r.stars[3]).toBe(3);
    expect(r.stars.slice(99).every((s) => s === 0)).toBe(true);
  });

  it("只读一次：第二次调用什么都不搬，成绩也不变", () => {
    const legacy = new Array<number>(TOTAL_LEVELS).fill(0);
    legacy[10] = 3;
    const store = memStore({ [LEGACY_CAMPAIGN_KEY]: JSON.stringify({ stars: legacy }) });
    const first = migrateLegacyCampaign(store, "gomoku-mig3");
    expect(first.migrated).toBe(true);
    const second = migrateLegacyCampaign(store, "gomoku-mig3");
    expect(second.migrated).toBe(false);
    expect(second.moved).toBe(0);
    expect(second.stars[10]).toBe(3);
  });

  it("新档已经更好时不会被旧档覆盖掉", () => {
    const legacy = new Array<number>(TOTAL_LEVELS).fill(0);
    legacy[2] = 1;
    const store = memStore({ [LEGACY_CAMPAIGN_KEY]: JSON.stringify({ stars: legacy }) });
    saveStar("gomoku-mig4", 2, 3, store);
    const r = migrateLegacyCampaign(store, "gomoku-mig4");
    expect(r.stars[2]).toBe(3);
    expect(r.moved).toBe(0);
  });

  it("旧 key 不存在 / 是坏数据时都不炸", () => {
    const empty = memStore();
    expect(migrateLegacyCampaign(empty, "gomoku-mig5").migrated).toBe(false);
    const broken = memStore({ [LEGACY_CAMPAIGN_KEY]: "{{{" });
    const r = migrateLegacyCampaign(broken, "gomoku-mig6");
    expect(r.migrated).toBe(true);
    expect(r.moved).toBe(0);
    expect(broken.getItem(LEGACY_CAMPAIGN_KEY)).toBeNull();
  });

  it("裸数组、脏数据都能整理成 188 星", () => {
    const parsed = parseLegacyStars([3, "x", null, 9, -1, 2.6]);
    expect(parsed).toHaveLength(TOTAL_LEVELS);
    expect(parsed[0]).toBe(3);
    expect(parsed[1]).toBe(0);
    expect(parsed[3]).toBe(3);
    expect(parsed[4]).toBe(0);
    expect(parsed[5]).toBe(3);
    expect(parseLegacyStars(null)).toHaveLength(TOTAL_LEVELS);
  });
});
