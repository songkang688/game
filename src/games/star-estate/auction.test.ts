import { describe, expect, it } from "vitest";
import { BID_STEP, auctionLine, auctionOnce, type Bidder } from "./auction";

const NAME = (id: number): string => ["朵朵", "星星", "糯糯", "云云"][id] ?? "银行";

describe("无底价拍卖", () => {
  it("一个人都不出价就流拍，地留在银行手里", () => {
    const r = auctionOnce(1, [
      { id: 0, limit: 0, cash: 500 },
      { id: 1, limit: 5, cash: 500 }
    ]);
    expect(r.winner).toBe(-1);
    expect(r.price).toBe(0);
    expect(r.passed).toEqual([0, 1]);
    expect(auctionLine(1, r, NAME)).toContain("没人出价");
  });

  it("只有一个人愿意出价，10 星币就拿下", () => {
    const r = auctionOnce(1, [
      { id: 0, limit: 300, cash: 300 },
      { id: 1, limit: 0, cash: 0 }
    ]);
    expect(r.winner).toBe(0);
    expect(r.price).toBe(BID_STEP);
    expect(auctionLine(1, r, NAME)).toContain("朵朵");
  });

  it("一档一档往上加，谁先到上限谁出局", () => {
    const r = auctionOnce(1, [
      { id: 0, limit: 50, cash: 999 },
      { id: 1, limit: 120, cash: 999 }
    ]);
    expect(r.winner).toBe(1);
    expect(r.price).toBe(60);
    expect(r.history[0]).toEqual({ id: 0, bid: 10 });
    expect(r.history[1]).toEqual({ id: 1, bid: 20 });
    expect(r.history[r.history.length - 1]).toEqual({ id: 1, bid: 60 });
  });

  it("心理价位一样时，出价顺序决定谁拿下", () => {
    const both: Bidder[] = [
      { id: 0, limit: 100, cash: 999 },
      { id: 1, limit: 100, cash: 999 }
    ];
    const a = auctionOnce(1, both);
    expect(a.winner).toBe(1);
    expect(a.price).toBe(100);
    const b = auctionOnce(1, [both[1], both[0]]);
    expect(b.winner).toBe(0);
    expect(b.price).toBe(100);
  });

  it("现金不够就喊不到心理价位，钱包才是真正的上限", () => {
    const r = auctionOnce(39, [
      { id: 0, limit: 900, cash: 45 },
      { id: 1, limit: 200, cash: 200 }
    ]);
    // 0 号的心理价位是 900，但兜里只有 45，喊到 50 就跟不上了
    expect(r.winner).toBe(1);
    expect(r.price).toBe(40);
  });

  it("三个人也能一路抬价，出价记录是升序的", () => {
    const r = auctionOnce(39, [
      { id: 0, limit: 80, cash: 999 },
      { id: 1, limit: 260, cash: 999 },
      { id: 2, limit: 190, cash: 999 }
    ]);
    expect(r.winner).toBe(1);
    expect(r.price).toBe(200);
    for (let i = 1; i < r.history.length; i++) {
      expect(r.history[i].bid).toBeGreaterThan(r.history[i - 1].bid);
    }
    expect(r.passed).toEqual([]);
  });

  it("空名单不会崩，也不会死循环", () => {
    const r = auctionOnce(1, []);
    expect(r.winner).toBe(-1);
    expect(r.rounds).toBe(0);
  });
});
