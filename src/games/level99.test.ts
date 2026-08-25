import { describe, expect, it } from "vitest";
import {
  TOTAL_LEVELS,
  chapterOf,
  chapterStart,
  clearedCount,
  furthestPlayable,
  indexInChapter,
  loadStars,
  mulberry32,
  randInt,
  rateAbove,
  rateBelow,
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

const CHAPTERS: Chapter[] = [
  { name: "一", emoji: "1️⃣", color: "#fff", desc: "", size: 17 },
  { name: "二", emoji: "2️⃣", color: "#fff", desc: "", size: 17 },
  { name: "三", emoji: "3️⃣", color: "#fff", desc: "", size: 17 },
  { name: "四", emoji: "4️⃣", color: "#fff", desc: "", size: 16 },
  { name: "五", emoji: "5️⃣", color: "#fff", desc: "", size: 16 },
  { name: "六", emoji: "6️⃣", color: "#fff", desc: "", size: 16 }
];

describe("level99 章节工具", () => {
  it("总关卡数固定为 99", () => {
    expect(TOTAL_LEVELS).toBe(99);
    expect(totalSize(CHAPTERS)).toBe(99);
  });

  it("chapterOf / chapterStart / indexInChapter 一致", () => {
    expect(chapterOf(CHAPTERS, 0)).toBe(0);
    expect(chapterOf(CHAPTERS, 16)).toBe(0);
    expect(chapterOf(CHAPTERS, 17)).toBe(1);
    expect(chapterOf(CHAPTERS, 98)).toBe(5);
    expect(chapterStart(CHAPTERS, 0)).toBe(0);
    expect(chapterStart(CHAPTERS, 3)).toBe(51);
    expect(indexInChapter(CHAPTERS, 51)).toBe(0);
    expect(indexInChapter(CHAPTERS, 98)).toBe(15);
  });
});

describe("level99 星级存档", () => {
  it("初始 99 关全部 0 星", () => {
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

  it("坏数据不会让存档崩溃", () => {
    const st = memStorage();
    st.setItem("yiduo-yixing.l99.demo", "{oops");
    const stars = loadStars("demo", st);
    expect(stars.every((s) => s === 0)).toBe(true);
  });

  it("星级越界会被夹回 0..3", () => {
    const st = memStorage();
    const stars = saveStar("demo", 5, 99, st);
    expect(stars[5]).toBe(3);
  });

  it("全部通关后 furthestPlayable 停在最后一关", () => {
    const st = memStorage();
    for (let i = 0; i < TOTAL_LEVELS; i++) saveStar("demo", i, 1, st);
    expect(furthestPlayable(loadStars("demo", st))).toBe(TOTAL_LEVELS - 1);
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

  it("失败朗读:先安抚再鼓励,绝无批评措辞", () => {
    const line = settleSpeechLine("lose", 4, "没关系，慢慢来，你可以的！");
    expect(line).toBe("就差一点点！没关系，慢慢来，你可以的！");
    expect(line).not.toMatch(/输|失败|错/);
  });
});
