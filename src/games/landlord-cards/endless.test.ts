/**
 * 守门：♾️ 无尽连胜「输了之后重开」不许永远发同一副牌（第 2 轮测试员 W5R2-A-04）。
 *
 * 老代码在 `showOver()` 的「🔁 从第 1 局再来」里把 `bump` 和 `streak` 一起清成 0，
 * `startRound()` 于是回到 `buildEndlessRound(1).seed + 0` —— 种子恒定。
 * 实测连开三次首局，手牌签名逐字相同，孩子在第 1 局卡住就会一直卡在同一副牌上。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildEndlessRound, endlessDealSeed } from "./levels";
import { dealCards } from "./logic";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");

/** 一手牌的签名：同一副牌一定一样，换了牌一定不一样 */
function sign(hand: number[]): string {
  return [...hand].sort((a, b) => a - b).join(",");
}

describe("无尽连胜的发牌种子", () => {
  it("同一局同一次重开，种子稳定（重进也是同一副，不是随机漂）", () => {
    expect(endlessDealSeed(1, 0)).toBe(buildEndlessRound(1).seed);
    expect(endlessDealSeed(1, 0)).toBe(endlessDealSeed(1, 0));
    expect(endlessDealSeed(4, 2)).toBe(endlessDealSeed(4, 2));
  });

  it("重开次数每加一次，种子就换一个", () => {
    const seen = new Set<number>();
    for (let attempt = 0; attempt < 20; attempt++) seen.add(endlessDealSeed(1, attempt));
    expect(seen.size, "20 次重开里出现了重复的种子").toBe(20);
  });

  it("连开 8 次第 1 局，8 副牌互不相同", () => {
    const seen = new Set<string>();
    for (let attempt = 0; attempt < 8; attempt++) {
      const d = dealCards(endlessDealSeed(1, attempt));
      seen.add(sign(d.hands[0]));
    }
    expect(seen.size, "重开之后又发了一模一样的牌").toBe(8);
    // 反例：老口径（种子恒定 `buildEndlessRound(1).seed`）连开 8 次只有 1 副牌
    const old = new Set<string>();
    for (let attempt = 0; attempt < 8; attempt++) {
      old.add(sign(dealCards(buildEndlessRound(1).seed).hands[0]));
    }
    expect(old.size, "反例失效了：老口径本来就该只有 1 副牌").toBe(1);
  });

  it("不同局之间也不撞车（前 12 局 × 前 6 次重开共 72 副牌全不同）", () => {
    const seen = new Set<string>();
    for (let round = 1; round <= 12; round++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        seen.add(sign(dealCards(endlessDealSeed(round, attempt)).hands[0]));
      }
    }
    expect(seen.size).toBe(72);
  });

  it("负数与小数的重开次数收得住，不会算出 NaN 种子", () => {
    expect(endlessDealSeed(1, -3)).toBe(endlessDealSeed(1, 0));
    expect(endlessDealSeed(1, 1.4)).toBe(endlessDealSeed(1, 1));
    expect(Number.isFinite(endlessDealSeed(1, 0))).toBe(true);
  });
});

describe("无尽连胜的重开接线", () => {
  const endless = shell.slice(shell.indexOf("function mountEndless"), shell.indexOf("function mountVersus"));

  it("无尽这一段里发牌走的是 endlessDealSeed，没有第二处自己拼种子", () => {
    expect(endless).toContain("endlessDealSeed(");
    expect(endless).not.toMatch(/dealCards\(\s*round\.seed/);
  });

  it("「从第 1 局再来」只把连胜清零，重开次数只增不减", () => {
    const again = endless.slice(endless.indexOf("从第 1 局再来"));
    const handler = again.slice(0, again.indexOf("box.appendChild"));
    expect(handler).toContain("streak = 0");
    expect(handler, "又把 bump 清成 0 了，第 1 局会永远发同一副牌").not.toMatch(/bump\s*=\s*0/);
    expect(handler).toContain("bump++");
  });

  it("⚔️ 双人对战那边照旧：换局本来就换牌，不用跟着改", () => {
    const versus = shell.slice(shell.indexOf("function mountVersus"));
    const again = versus.slice(versus.indexOf("再来一局"));
    expect(again.slice(0, again.indexOf("box.appendChild"))).toContain("round++");
  });
});
