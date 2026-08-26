/**
 * 钓鱼小达人 · 鱼类图鉴 v2 单测。
 *
 * 图鉴是唯一一份「玩了半年才攒出来」的存档,所以这里最看重两件事:
 * 序列化往返一个字段都不许丢,坏数据一律安静降级成空图鉴而不是抛异常。
 */
import { describe, expect, it } from "vitest";
import {
  DEX2_KEY,
  DEX_VERSION,
  bestSizeText,
  dexEntry,
  dexHas,
  dexStats,
  emptyDex,
  firstCatchText,
  markReleased,
  parseDexBook,
  recordCatch,
  serializeDexBook,
  type DexBook,
} from "./dex";
import { DEX_KEY, FISH, GAME_ID, RARITY_TIERS, baseLengthCm, rollLengthCm } from "./logic";

const A = FISH[0];
const B = FISH[7];
const BIG = FISH[FISH.length - 1];

const T1 = Date.UTC(2026, 4, 18, 9, 30);
const T2 = Date.UTC(2026, 6, 2, 20, 15);

function withCatches(...recs: { id: string; cm: number; at: number; released?: boolean }[]): DexBook {
  let book = emptyDex();
  for (const r of recs) book = recordCatch(book, r).book;
  return book;
}

describe("图鉴 v2 · 存档 key", () => {
  it("key 挂在本应用前缀下,带游戏 id 和版本,而且和 1.1 那份不是同一个", () => {
    expect(DEX2_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(DEX2_KEY).toContain(GAME_ID);
    expect(DEX2_KEY).not.toBe(DEX_KEY);
    expect(DEX_VERSION).toBe(2);
  });
});

describe("图鉴 v2 · 记一条鱼", () => {
  it("第一次钓到会记下时间与体长,并报告这是新鱼种", () => {
    const out = recordCatch(emptyDex(), { id: A.id, cm: 30.5, at: T1 });
    expect(out.isNew).toBe(true);
    expect(out.isBiggest).toBe(true);
    const entry = dexEntry(out.book, A.id);
    expect(entry?.firstAt).toBe(T1);
    expect(entry?.bestCm).toBe(30.5);
    expect(entry?.caught).toBe(1);
    expect(entry?.released).toBe(0);
  });

  it("再钓一条只更新条数与最大尺寸,首次时间永远是第一次那一次", () => {
    const book = withCatches({ id: A.id, cm: 30.5, at: T1 });
    const out = recordCatch(book, { id: A.id, cm: 41.2, at: T2 });
    expect(out.isNew).toBe(false);
    expect(out.isBiggest).toBe(true);
    expect(dexEntry(out.book, A.id)?.firstAt).toBe(T1);
    expect(dexEntry(out.book, A.id)?.bestCm).toBe(41.2);
    expect(dexEntry(out.book, A.id)?.caught).toBe(2);
  });

  it("钓到一条更小的不会把纪录改小", () => {
    const book = withCatches({ id: A.id, cm: 41.2, at: T1 });
    const out = recordCatch(book, { id: A.id, cm: 20, at: T2 });
    expect(out.isBiggest).toBe(false);
    expect(dexEntry(out.book, A.id)?.bestCm).toBe(41.2);
  });

  it("放生会记一笔,而且只有第一次放生这一种鱼才给奖励", () => {
    const first = recordCatch(emptyDex(), { id: B.id, cm: 25, at: T1, released: true });
    expect(first.firstRelease).toBe(true);
    const again = recordCatch(first.book, { id: B.id, cm: 26, at: T2, released: true });
    expect(again.firstRelease).toBe(false);
    expect(dexEntry(again.book, B.id)?.released).toBe(2);
    expect(dexEntry(again.book, B.id)?.caught).toBe(2);
  });

  it("把手上这一条放生:不多算一次捕获,只有第一次给奖励", () => {
    const book = withCatches({ id: B.id, cm: 25, at: T1 });
    const one = markReleased(book, B.id);
    expect(one.firstRelease).toBe(true);
    expect(dexEntry(one.book, B.id)?.released).toBe(1);
    expect(dexEntry(one.book, B.id)?.caught).toBe(1);
    const two = markReleased(one.book, B.id);
    expect(two.firstRelease).toBe(false);
    expect(dexEntry(two.book, B.id)?.released).toBe(2);
  });

  it("没见过的鱼放生不了,图鉴原样还回来", () => {
    const book = emptyDex();
    const out = markReleased(book, B.id);
    expect(out.book).toBe(book);
    expect(out.firstRelease).toBe(false);
    expect(markReleased(book, "查无此鱼").firstRelease).toBe(false);
  });

  it("不认识的鱼 id 一律忽略,原样把图鉴还回来", () => {
    const book = withCatches({ id: A.id, cm: 30, at: T1 });
    const out = recordCatch(book, { id: "查无此鱼", cm: 99, at: T2 });
    expect(out.book).toBe(book);
    expect(out.isNew).toBe(false);
    expect(dexStats(out.book).found).toBe(1);
  });

  it("记一条鱼不会改动旧的那一份图鉴(纯函数)", () => {
    const before = withCatches({ id: A.id, cm: 30, at: T1 });
    const snapshot = JSON.stringify(before);
    recordCatch(before, { id: B.id, cm: 22, at: T2 });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("图鉴 v2 · 序列化往返", () => {
  it("写出去再读回来,四个字段一模一样", () => {
    const book = withCatches(
      { id: A.id, cm: 30.5, at: T1 },
      { id: A.id, cm: 41.2, at: T2 },
      { id: B.id, cm: 22.4, at: T2, released: true },
      { id: BIG.id, cm: 80, at: T2 }
    );
    const back = parseDexBook(serializeDexBook(book));
    expect(back).toEqual(book);
    expect(dexEntry(back, A.id)?.caught).toBe(2);
    expect(dexEntry(back, B.id)?.released).toBe(1);
  });

  it("同一份图鉴序列化两次得到同一段文本(按图鉴顺序排好)", () => {
    const one = withCatches({ id: BIG.id, cm: 70, at: T1 }, { id: A.id, cm: 30, at: T2 });
    const two = withCatches({ id: A.id, cm: 30, at: T2 }, { id: BIG.id, cm: 70, at: T1 });
    expect(serializeDexBook(one)).toBe(serializeDexBook(two));
    expect(serializeDexBook(emptyDex())).toBe(JSON.stringify({ v: 2, e: {} }));
  });

  it("坏数据一律当空图鉴,一次都不抛异常", () => {
    for (const raw of [null, undefined, "", "不是 JSON", "[1,2,3]", '{"v":2}', '{"e":5}', '{"e":[1,2]}']) {
      expect(dexStats(parseDexBook(raw)).found, String(raw)).toBe(0);
    }
  });

  it("认不出的鱼 id、负数、NaN 字段都会被扔掉或夹回 0", () => {
    const raw = JSON.stringify({
      v: 2,
      e: {
        "查无此鱼": { t: 1, b: 2, n: 3, r: 4 },
        [A.id]: { t: -5, b: Number.NaN, n: -9, r: "多少" },
      },
    });
    const book = parseDexBook(raw);
    expect(dexHas(book, "查无此鱼")).toBe(false);
    const entry = dexEntry(book, A.id);
    expect(entry?.firstAt).toBe(0);
    expect(entry?.bestCm).toBe(0);
    // 存档里有这一条就说明见过,条数至少算 1
    expect(entry?.caught).toBe(1);
    expect(entry?.released).toBe(0);
  });

  it("1.1 那份 id 列表能迁移过来:认得脸,但没有时间与尺寸", () => {
    const legacy = JSON.stringify([A.id, BIG.id, "查无此鱼"]);
    const book = parseDexBook(null, legacy);
    expect(dexStats(book).found).toBe(2);
    expect(dexEntry(book, BIG.id)?.firstAt).toBe(0);
    expect(dexEntry(book, BIG.id)?.bestCm).toBe(0);
    expect(dexHas(book, "查无此鱼")).toBe(false);
  });

  it("迁移不会盖掉 v2 里已经有的记录", () => {
    const v2 = serializeDexBook(withCatches({ id: A.id, cm: 33, at: T1 }));
    const book = parseDexBook(v2, JSON.stringify([A.id, B.id]));
    expect(dexEntry(book, A.id)?.bestCm).toBe(33);
    expect(dexEntry(book, A.id)?.firstAt).toBe(T1);
    expect(dexHas(book, B.id)).toBe(true);
  });
});

describe("图鉴 v2 · 统计与文案", () => {
  it("收录度按整数百分比算,四档分别统计", () => {
    const empty = dexStats(emptyDex());
    expect(empty).toMatchObject({ found: 0, total: FISH.length, percent: 0, caught: 0, released: 0 });
    expect(empty.byTier.length).toBe(RARITY_TIERS.length);

    let all = emptyDex();
    for (const f of FISH) all = recordCatch(all, { id: f.id, cm: baseLengthCm(f), at: T1 }).book;
    const full = dexStats(all);
    expect(full.found).toBe(FISH.length);
    expect(full.percent).toBe(100);
    expect(full.byTier.reduce((a, b) => a + b, 0)).toBe(FISH.length);
  });

  it("钓过的总条数与放生数都算得对", () => {
    const book = withCatches(
      { id: A.id, cm: 30, at: T1 },
      { id: A.id, cm: 31, at: T1, released: true },
      { id: B.id, cm: 20, at: T1, released: true }
    );
    const stats = dexStats(book);
    expect(stats.found).toBe(2);
    expect(stats.caught).toBe(3);
    expect(stats.released).toBe(2);
  });

  it("最大尺寸那一行:没记录说没记录,破了标准体长要夸一句", () => {
    expect(bestSizeText(A, undefined)).toContain("还没记录");
    const small = dexEntry(withCatches({ id: A.id, cm: rollLengthCm(A, 0), at: T1 }), A.id);
    expect(bestSizeText(A, small)).toContain("还能再大");
    const big = dexEntry(withCatches({ id: A.id, cm: rollLengthCm(A, 1), at: T1 }), A.id);
    expect(bestSizeText(A, big)).toContain("大个头");
    expect(bestSizeText(A, big)).toContain("厘米");
  });

  it("首次捕获时间写成中文日期,老存档说「很早以前」", () => {
    const entry = dexEntry(withCatches({ id: A.id, cm: 30, at: T1 }), A.id);
    const text = firstCatchText(entry, T1);
    expect(text).toContain("首次捕获");
    expect(text).toContain("月");
    expect(firstCatchText(undefined)).toContain("还没见过");
    expect(firstCatchText({ id: A.id, firstAt: 0, bestCm: 0, caught: 1, released: 0 })).toContain("很早以前");
  });
});
