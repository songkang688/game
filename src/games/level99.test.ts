import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ROOT_TTL_MS,
  clearRootSession,
  resetRoot12Extras,
  writeRootSession
} from "../ui/root12Contract";
import {
  jumpTargetLevel,
  rootJumpNote,
  rootJumpVisible,
  skipNeedsParentAuth
} from "./level99";
import {
  LEGACY_TOTAL_LEVELS,
  MAX_TOTAL_STARS,
  TOTAL_LEVELS,
  assertTotal,
  buildFallbackGuide,
  chapterOf,
  chapterRange,
  chapterStart,
  clearSkips,
  clearedCount,
  effectiveTotal,
  furthestPlayable,
  indexInChapter,
  isSkipped,
  loadSkips,
  loadStars,
  mapColumns,
  markSkipped,
  migrateSkips,
  migrateStars,
  mulberry32,
  nodeAriaLabel,
  randInt,
  rateAbove,
  rateBelow,
  reachedCount,
  saveStar,
  settleSpeechLine,
  shuffled,
  totalSize,
  totalStars,
  type Chapter,
  type StorageLike
} from "./level99";

function memStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    }
  };
}

/** 1.2 管理员权限测试用的假「现在」：全程假时钟，不真等一小时 */
const NOW = 1_700_000_000_000;

/** 1.0 时代的六章切分（和 = 99），用来验证「章节和不对」时的降级行为 */
const LEGACY_CHAPTERS: Chapter[] = [
  { name: "一", emoji: "1️⃣", color: "#fff", desc: "", size: 17 },
  { name: "二", emoji: "2️⃣", color: "#fff", desc: "", size: 17 },
  { name: "三", emoji: "3️⃣", color: "#fff", desc: "", size: 17 },
  { name: "四", emoji: "4️⃣", color: "#fff", desc: "", size: 16 },
  { name: "五", emoji: "5️⃣", color: "#fff", desc: "", size: 16 },
  { name: "六", emoji: "6️⃣", color: "#fff", desc: "", size: 16 }
];

/** 1.1 的九章切分（和 = 188）：前六章与 1.0 完全一致，新内容只在末尾追加 */
const CHAPTERS: Chapter[] = [
  ...LEGACY_CHAPTERS,
  { name: "七", emoji: "7️⃣", color: "#fff", desc: "新机制登场", size: 30 },
  { name: "八", emoji: "8️⃣", color: "#fff", desc: "多步推理", size: 30 },
  { name: "九", emoji: "9️⃣", color: "#fff", desc: "收官挑战", size: 29 }
];

describe("level99 章节工具", () => {
  it("总关卡数升到 188，同时保留 99 作为迁移常量", () => {
    expect(TOTAL_LEVELS).toBe(188);
    expect(LEGACY_TOTAL_LEVELS).toBe(99);
    expect(MAX_TOTAL_STARS).toBe(564);
    expect(totalSize(CHAPTERS)).toBe(188);
  });

  it("前六章切分与 1.0 完全一致（回归）", () => {
    expect(LEGACY_CHAPTERS.map((c) => c.size)).toEqual([17, 17, 17, 16, 16, 16]);
    expect(totalSize(LEGACY_CHAPTERS)).toBe(LEGACY_TOTAL_LEVELS);
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual([17, 17, 17, 16, 16, 16]);
  });

  it("chapterOf / chapterStart / indexInChapter 一致（含 188 边界）", () => {
    expect(chapterOf(CHAPTERS, 0)).toBe(0);
    expect(chapterOf(CHAPTERS, 16)).toBe(0);
    expect(chapterOf(CHAPTERS, 17)).toBe(1);
    expect(chapterOf(CHAPTERS, 98)).toBe(5);
    expect(chapterOf(CHAPTERS, 99)).toBe(6);
    expect(chapterOf(CHAPTERS, 187)).toBe(8);
    expect(chapterStart(CHAPTERS, 0)).toBe(0);
    expect(chapterStart(CHAPTERS, 3)).toBe(51);
    expect(chapterStart(CHAPTERS, 6)).toBe(99);
    expect(indexInChapter(CHAPTERS, 51)).toBe(0);
    expect(indexInChapter(CHAPTERS, 99)).toBe(0);
    expect(indexInChapter(CHAPTERS, 187)).toBe(28);
  });

  it("assertTotal：和等于 188 返回 true 且不报错", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(assertTotal(CHAPTERS, 188)).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("assertTotal：和不等于 188 时报错但不抛异常", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => assertTotal(LEGACY_CHAPTERS, 188, "demo")).not.toThrow();
      expect(assertTotal(LEGACY_CHAPTERS, 188, "demo")).toBe(false);
      expect(spy).toHaveBeenCalled();
      expect(String(spy.mock.calls[0][0])).toContain("demo");
    } finally {
      spy.mockRestore();
    }
  });

  it("assertTotal 默认拿 TOTAL_LEVELS 当期望值", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(assertTotal(CHAPTERS)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("effectiveTotal：章节和不对时降级到实际总数，空章节也至少 1 关", () => {
    expect(effectiveTotal(CHAPTERS)).toBe(188);
    expect(effectiveTotal(LEGACY_CHAPTERS)).toBe(99);
    expect(effectiveTotal([])).toBe(1);
  });

  it("chapterRange 给出 1 基的分页区间", () => {
    expect(chapterRange(CHAPTERS, 0)).toEqual({ from: 1, to: 17 });
    expect(chapterRange(CHAPTERS, 6)).toEqual({ from: 100, to: 129 });
    expect(chapterRange(CHAPTERS, 8)).toEqual({ from: 160, to: 188 });
  });

  it("mapColumns：窄屏每行格子数自适应（≤420px 明显变少）", () => {
    expect(mapColumns(320)).toBe(4);
    expect(mapColumns(390)).toBe(5);
    expect(mapColumns(420)).toBe(5);
    expect(mapColumns(560)).toBe(6);
    expect(mapColumns(1200)).toBe(8);
    expect(mapColumns(390)).toBeLessThan(mapColumns(1200));
    expect(mapColumns(0)).toBe(5);
    expect(mapColumns(Number.NaN)).toBe(5);
  });
});

describe("level99 星级存档（188 关）", () => {
  it("初始 188 关全部 0 星", () => {
    const st = memStorage();
    const stars = loadStars("demo", st);
    expect(stars).toHaveLength(TOTAL_LEVELS);
    expect(stars.every((s) => s === 0)).toBe(true);
    expect(furthestPlayable(stars)).toBe(0);
  });

  it("saveStar 记录星级并保留最好成绩", () => {
    const st = memStorage();
    saveStar("demo", 0, 2, st);
    let stars = saveStar("demo", 0, 1, st);
    expect(stars[0]).toBe(2);
    stars = saveStar("demo", 0, 3, st);
    expect(stars[0]).toBe(3);
    expect(totalStars(stars)).toBe(3);
    expect(clearedCount(stars)).toBe(1);
    expect(furthestPlayable(stars)).toBe(1);
  });

  it("saveStar 写回的一定是长度 188 的数组", () => {
    const st = memStorage();
    saveStar("demo", 187, 3, st);
    const raw = st.getItem("yiduo-yixing.l99.demo") as string;
    expect(JSON.parse(raw)).toHaveLength(TOTAL_LEVELS);
  });

  it("第 188 关（下标 187）能存，188 及以上越界被忽略", () => {
    const st = memStorage();
    let stars = saveStar("demo", 187, 3, st);
    expect(stars[187]).toBe(3);
    stars = saveStar("demo", 188, 3, st);
    expect(stars).toHaveLength(TOTAL_LEVELS);
    expect(totalStars(stars)).toBe(3);
    stars = saveStar("demo", -1, 3, st);
    expect(totalStars(stars)).toBe(3);
  });

  it("满分是 564 星", () => {
    const st = memStorage();
    for (let i = 0; i < TOTAL_LEVELS; i++) saveStar("demo", i, 3, st);
    const stars = loadStars("demo", st);
    expect(totalStars(stars)).toBe(MAX_TOTAL_STARS);
    expect(clearedCount(stars)).toBe(188);
  });

  it("老存档（长度 99）读出来是 188 长、前 99 位原样保留、后面补 0", () => {
    const st = memStorage();
    const legacy = Array.from({ length: LEGACY_TOTAL_LEVELS }, (_, i) => (i % 3) + 1);
    st.setItem("yiduo-yixing.l99.math-farm", JSON.stringify(legacy));
    const stars = loadStars("math-farm", st);
    expect(stars).toHaveLength(TOTAL_LEVELS);
    expect(stars.slice(0, LEGACY_TOTAL_LEVELS)).toEqual(legacy);
    expect(stars.slice(LEGACY_TOTAL_LEVELS).every((s) => s === 0)).toBe(true);
  });

  it("老存档迁移后继续玩，第 100 关照常写入且不动前 99 位", () => {
    const st = memStorage();
    const legacy = new Array<number>(LEGACY_TOTAL_LEVELS).fill(3);
    st.setItem("yiduo-yixing.l99.demo", JSON.stringify(legacy));
    const stars = saveStar("demo", 99, 2, st);
    expect(stars.slice(0, 99).every((s) => s === 3)).toBe(true);
    expect(stars[99]).toBe(2);
    expect(stars).toHaveLength(TOTAL_LEVELS);
  });

  it("老存档全通关时，最远可玩关直接落到第 100 关", () => {
    const st = memStorage();
    st.setItem("yiduo-yixing.l99.demo", JSON.stringify(new Array<number>(99).fill(1)));
    expect(furthestPlayable(loadStars("demo", st))).toBe(99);
  });

  it("migrateStars 纯函数：补 0 / 截断 / 夹到 0..3", () => {
    expect(migrateStars([1, 2, 3])).toHaveLength(TOTAL_LEVELS);
    expect(migrateStars([1, 2, 3]).slice(0, 3)).toEqual([1, 2, 3]);
    expect(migrateStars(new Array<number>(300).fill(3))).toHaveLength(TOTAL_LEVELS);
    expect(migrateStars([9, -4, 2.6]).slice(0, 3)).toEqual([3, 0, 3]);
  });

  it("坏数据不会让存档崩溃", () => {
    const st = memStorage();
    st.setItem("yiduo-yixing.l99.demo", "{oops");
    const stars = loadStars("demo", st);
    expect(stars).toHaveLength(TOTAL_LEVELS);
    expect(stars.every((s) => s === 0)).toBe(true);
  });

  it("非数组 / 元素非数字 / 超长的存档都静默降级", () => {
    const st = memStorage();
    st.setItem("yiduo-yixing.l99.a", JSON.stringify({ hi: 1 }));
    expect(loadStars("a", st).every((s) => s === 0)).toBe(true);
    st.setItem("yiduo-yixing.l99.b", JSON.stringify(["x", null, true, 2]));
    expect(loadStars("b", st).slice(0, 4)).toEqual([0, 0, 0, 2]);
    st.setItem("yiduo-yixing.l99.c", JSON.stringify(new Array<number>(500).fill(2)));
    const c = loadStars("c", st);
    expect(c).toHaveLength(TOTAL_LEVELS);
    expect(totalStars(c)).toBe(TOTAL_LEVELS * 2);
    st.setItem("yiduo-yixing.l99.d", JSON.stringify([Number.NaN, Number.POSITIVE_INFINITY, 1]));
    expect(loadStars("d", st).slice(0, 3)).toEqual([0, 0, 1]);
  });

  it("存档 key 仍是 yiduo-yixing.l99.<id>，一个字都没改", () => {
    const st = memStorage();
    saveStar("math-farm", 3, 2, st);
    expect(st.getItem("yiduo-yixing.l99.math-farm")).not.toBeNull();
  });

  it("星级越界会被夹回 0..3", () => {
    const st = memStorage();
    const stars = saveStar("demo", 5, 99, st);
    expect(stars[5]).toBe(3);
    expect(saveStar("demo", 6, -5, st)[6]).toBe(0);
  });

  it("全部通关后 furthestPlayable 停在最后一关", () => {
    const st = memStorage();
    for (let i = 0; i < TOTAL_LEVELS; i++) saveStar("demo", i, 1, st);
    expect(furthestPlayable(loadStars("demo", st))).toBe(TOTAL_LEVELS - 1);
  });

  it("furthestPlayable 支持降级总数（章节和不是 188 的游戏不会越界）", () => {
    const stars = new Array<number>(TOTAL_LEVELS).fill(0);
    for (let i = 0; i < 99; i++) stars[i] = 3;
    expect(furthestPlayable(stars, [], 99)).toBe(98);
    expect(furthestPlayable(stars, [], 188)).toBe(99);
    expect(furthestPlayable(stars, [], 0)).toBe(0);
  });

  it("默认存储探测完不残留 probe key", () => {
    const map = new Map<string, string>();
    const fake: StorageLike = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      }
    };
    const g = globalThis as { localStorage?: StorageLike };
    const prev = g.localStorage;
    g.localStorage = fake;
    try {
      loadStars("demo");
      expect(map.has("yiduo-yixing.l99.probe")).toBe(false);
    } finally {
      if (prev === undefined) delete g.localStorage;
      else g.localStorage = prev;
    }
  });

  it("没有可用存储时也能读写（内存兜底，不抛异常）", () => {
    expect(() => saveStar("mem-demo", 2, 3, null)).not.toThrow();
    expect(loadStars("mem-demo", null)[2]).toBe(3);
  });
});

describe("level99 跳关标记", () => {
  it("跳关写在并存的小 key 上，不动原来的星级 key", () => {
    const st = memStorage();
    saveStar("demo", 0, 3, st);
    markSkipped("demo", 1, st);
    expect(st.getItem("yiduo-yixing.l99skip.demo")).toBe("[1]");
    expect(JSON.parse(st.getItem("yiduo-yixing.l99.demo") as string)).toHaveLength(TOTAL_LEVELS);
    expect(loadStars("demo", st)[1]).toBe(0);
  });

  it("跳过的关星级仍记 0，但解锁后面一关", () => {
    const st = memStorage();
    const stars = loadStars("demo", st);
    const skips = markSkipped("demo", 0, st);
    expect(stars[0]).toBe(0);
    expect(furthestPlayable(stars, skips)).toBe(1);
    expect(clearedCount(stars)).toBe(0);
    expect(reachedCount(stars, skips)).toBe(1);
  });

  it("markSkipped 幂等且结果升序去重", () => {
    const st = memStorage();
    markSkipped("demo", 5, st);
    markSkipped("demo", 5, st);
    markSkipped("demo", 2, st);
    expect(loadSkips("demo", st)).toEqual([2, 5]);
  });

  it("markSkipped 越界（<0 或 ≥188）被忽略", () => {
    const st = memStorage();
    markSkipped("demo", -1, st);
    markSkipped("demo", 188, st);
    markSkipped("demo", 187, st);
    expect(loadSkips("demo", st)).toEqual([187]);
  });

  it("loadSkips 对坏数据静默降级为空", () => {
    const st = memStorage();
    st.setItem("yiduo-yixing.l99skip.a", "{oops");
    expect(loadSkips("a", st)).toEqual([]);
    st.setItem("yiduo-yixing.l99skip.b", JSON.stringify({ n: 1 }));
    expect(loadSkips("b", st)).toEqual([]);
    st.setItem("yiduo-yixing.l99skip.c", JSON.stringify(["3", null, 4, 4]));
    expect(loadSkips("c", st)).toEqual([4]);
  });

  it("migrateSkips 纯函数：过滤非法值并排序", () => {
    expect(migrateSkips([7, 3, 3, -2, 999, "x", Number.NaN])).toEqual([3, 7]);
    expect(migrateSkips(null)).toEqual([]);
    expect(migrateSkips([2.4])).toEqual([2]);
  });

  it("clearSkips 清空跳关记录但不动星级", () => {
    const st = memStorage();
    saveStar("demo", 4, 2, st);
    markSkipped("demo", 4, st);
    clearSkips("demo", st);
    expect(loadSkips("demo", st)).toEqual([]);
    expect(loadStars("demo", st)[4]).toBe(2);
  });

  it("isSkipped 判定单关", () => {
    expect(isSkipped([1, 4], 4)).toBe(true);
    expect(isSkipped([1, 4], 3)).toBe(false);
    expect(isSkipped([], 0)).toBe(false);
  });

  it("furthestPlayable 会跨过连续的跳过关", () => {
    const stars = new Array<number>(TOTAL_LEVELS).fill(0);
    stars[0] = 3;
    expect(furthestPlayable(stars, [1, 2, 3])).toBe(4);
    expect(furthestPlayable(stars, [2, 3])).toBe(1);
  });

  it("跳过的关后来真打过了，星级照常记录、跳关记录仍在（家长可查）", () => {
    const st = memStorage();
    markSkipped("demo", 3, st);
    const stars = saveStar("demo", 3, 3, st);
    expect(stars[3]).toBe(3);
    expect(loadSkips("demo", st)).toEqual([3]);
    expect(clearedCount(stars)).toBe(1);
  });

  it("reachedCount 把真通关与跳过一起算，clearedCount 只算真通关", () => {
    const stars = new Array<number>(TOTAL_LEVELS).fill(0);
    stars[0] = 1;
    stars[1] = 2;
    expect(clearedCount(stars)).toBe(2);
    expect(reachedCount(stars, [5, 6])).toBe(4);
    expect(reachedCount(stars, [0])).toBe(2);
    expect(reachedCount(stars)).toBe(2);
  });

  it("全部 188 关都被跳过时 furthestPlayable 停在最后一关", () => {
    const stars = new Array<number>(TOTAL_LEVELS).fill(0);
    const all = Array.from({ length: TOTAL_LEVELS }, (_, i) => i);
    expect(furthestPlayable(stars, all)).toBe(TOTAL_LEVELS - 1);
  });
});

describe("level99 地图无障碍与攻略兜底", () => {
  it("nodeAriaLabel 区分锁定 / 跳过 / 已通关 / 未通关", () => {
    expect(nodeAriaLabel(0, 0, "locked")).toBe("第 1 关，还没解锁");
    expect(nodeAriaLabel(9, 0, "skipped")).toBe("第 10 关，已跳过，可以回来挑战");
    expect(nodeAriaLabel(9, 3, "open")).toBe("第 10 关，已通关 3 星");
    expect(nodeAriaLabel(187, 0, "open")).toBe("第 188 关，还没通关");
  });

  it("buildFallbackGuide 按章节生成区间，且覆盖到第 188 关", () => {
    const book = buildFallbackGuide("demo", CHAPTERS);
    expect(book.gameId).toBe("demo");
    expect(book.entries).toHaveLength(CHAPTERS.length);
    expect(book.entries[0].from).toBe(1);
    expect(book.entries[book.entries.length - 1].to).toBe(188);
    expect(book.general.length).toBeGreaterThanOrEqual(3);
  });

  it("兜底攻略只讲方法，不出现答案字样，也不提任何外部作品名", () => {
    const book = buildFallbackGuide("demo", CHAPTERS, "算数小攻略");
    expect(book.title).toBe("算数小攻略");
    const text = [...book.general, ...book.entries.flatMap((e) => [e.title, ...e.tips])].join("");
    expect(text).not.toMatch(/答案是|正确答案/);
    expect(text).not.toMatch(/愤怒的小鸟|植物大战僵尸|水果忍者|超级玛丽|割绳子/);
  });
});

describe("level99 随机与评星工具", () => {
  it("mulberry32 是确定性的", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it("randInt 落在闭区间内", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const v = randInt(rand, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it("shuffled 保留全部元素", () => {
    const rand = mulberry32(3);
    const out = shuffled([1, 2, 3, 4, 5], rand);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("评星阈值", () => {
    expect(rateBelow(0, 1, 3)).toBe(3);
    expect(rateBelow(2, 1, 3)).toBe(2);
    expect(rateBelow(9, 1, 3)).toBe(1);
    expect(rateAbove(10, 9, 6)).toBe(3);
    expect(rateAbove(7, 9, 6)).toBe(2);
    expect(rateAbove(1, 9, 6)).toBe(1);
  });
});

describe("level99 结算朗读文案", () => {
  it("过关朗读:先报第几关过关,再连读鼓励语(关卡号是 1 基)", () => {
    expect(settleSpeechLine("win", 0, "太棒啦！")).toBe("第 1 关过关！太棒啦！");
    expect(settleSpeechLine("win", 98, "你做到啦！")).toBe("第 99 关过关！你做到啦！");
  });

  it("第 188 关的过关朗读也报对关号", () => {
    expect(settleSpeechLine("win", 187, "漂亮！")).toBe("第 188 关过关！漂亮！");
  });

  it("失败朗读:先安抚再鼓励,绝无批评措辞", () => {
    const line = settleSpeechLine("lose", 4, "没关系，慢慢来，你可以的！");
    expect(line).toBe("就差一点点！没关系，慢慢来，你可以的！");
    expect(line).not.toMatch(/输|失败|错/);
  });
});

// ---------------------------------------------------------------------------
// 1.2 新增：管理员权限「直达第 N 关」
// ---------------------------------------------------------------------------

describe("level99 直达第 N 关（管理员权限）", () => {
  beforeEach(() => {
    resetRoot12Extras();
    clearRootSession(null);
  });

  it("管理员权限关着时，直达控件根本不该出现", () => {
    expect(rootJumpVisible(NOW)).toBe(false);
  });

  it("管理员权限开着时，直达控件才出现", () => {
    writeRootSession(NOW + ROOT_TTL_MS, null);
    expect(rootJumpVisible(NOW)).toBe(true);
  });

  it("假时钟推进一小时后控件重新消失", () => {
    writeRootSession(NOW + ROOT_TTL_MS, null);
    expect(rootJumpVisible(NOW + 59 * 60_000)).toBe(true);
    expect(rootJumpVisible(NOW + ROOT_TTL_MS)).toBe(false);
  });

  it("能直达第 188 关（内部是 0 基的第 187）", () => {
    expect(jumpTargetLevel("188", TOTAL_LEVELS)).toBe(187);
    expect(jumpTargetLevel("1", TOTAL_LEVELS)).toBe(0);
    expect(jumpTargetLevel("100", TOTAL_LEVELS)).toBe(99);
  });

  it("越界输入被夹住，坏输入原地不动且不抛异常", () => {
    expect(jumpTargetLevel("0", TOTAL_LEVELS)).toBe(0);
    expect(jumpTargetLevel("189", TOTAL_LEVELS)).toBe(187);
    expect(jumpTargetLevel("1e9", TOTAL_LEVELS)).toBe(187);
    expect(jumpTargetLevel("-3", TOTAL_LEVELS)).toBe(0);
    expect(jumpTargetLevel("abc", TOTAL_LEVELS)).toBeNull();
    expect(jumpTargetLevel("", TOTAL_LEVELS)).toBeNull();
    expect(() => jumpTargetLevel("abc", TOTAL_LEVELS)).not.toThrow();
  });

  it("章节和异常降级后的总关数也夹得住，不会超出 188", () => {
    expect(jumpTargetLevel("99", 40)).toBe(39);
    expect(jumpTargetLevel("500", 999)).toBe(187);
  });

  it("直达一个没打过的关，星级数组一个字都不动", () => {
    const store = memStorage();
    saveStar("jump-demo", 0, 3, store);
    const before = loadStars("jump-demo", store);
    // 直达只算出关号，不碰任何存档写入口
    expect(jumpTargetLevel("187", TOTAL_LEVELS)).toBe(186);
    const after = loadStars("jump-demo", store);
    expect(after).toEqual(before);
    expect(after[186]).toBe(0);
    expect(loadSkips("jump-demo", store)).toEqual([]);
  });

  it("管理员权限开着时跳关免算术题，关着时仍旧走家长门", () => {
    expect(skipNeedsParentAuth(NOW)).toBe(true);
    writeRootSession(NOW + ROOT_TTL_MS, null);
    expect(skipNeedsParentAuth(NOW)).toBe(false);
    expect(skipNeedsParentAuth(NOW + ROOT_TTL_MS)).toBe(true);
  });

  it("直达控件旁边那行小字报剩余分钟，不写吓人词", () => {
    const note = rootJumpNote(43 * 60_000);
    expect(note).toBe("管理员权限还剩 43 分钟");
    expect(note.toLowerCase()).not.toContain("root");
  });

  it("N-38 永久态关内小字是「已永久开启」，不报远未来剩余分钟", () => {
    writeRootSession(9_999_999_999_000, null, "permanent");
    const huge = 4193047370 * 60_000;
    expect(rootJumpNote(huge, NOW)).toBe("管理员权限已永久开启");
    expect(rootJumpNote(huge, NOW)).not.toMatch(/\d+\s*分钟/);
    clearRootSession(null);
    expect(rootJumpNote(43 * 60_000, NOW)).toBe("管理员权限还剩 43 分钟");
  });

  it("加了直达之后总关数仍旧是 188，存档 key 语义没变", () => {
    expect(TOTAL_LEVELS).toBe(188);
    const store = memStorage();
    saveStar("key-demo", 5, 2, store);
    expect(store.getItem("yiduo-yixing.l99.key-demo")).toBeTruthy();
    markSkipped("key-demo", 5, store);
    expect(store.getItem("yiduo-yixing.l99skip.key-demo")).toBe("[5]");
  });
});
