/**
 * 文案的两条红线(规格第七节)。
 *
 * 一、**无血无伤无死亡**:小怪物被涂满是「变成小云朵飘走」,被撞到是「转个圈」,
 *     全套结算话术里不许冒出「血 / 死 / 伤 / 疼」这类字。
 * 二、**失败只鼓励**:没守住那一句必须给出下一步具体怎么做,不许挖苦。
 *
 * 顺带钉住「1.1 的塔防说法不许再出现」:1.2 是自己上场跑位出手,
 * 结算里再说「架炮台 / 摆路障 / 第几条道」孩子照着做只会更懵。
 */
import { describe, expect, it } from "vitest";
import {
  BANNED,
  SECTOR_NAMES,
  arenaCoopLine,
  arenaEndlessLine,
  arenaLoseLine,
  arenaVersusLine,
  arenaWinLine,
  draftTitle,
  isClean,
  sectorName,
} from "./copy";
import { LANES } from "./logic";
import { meta } from "./meta";

/** 1.1 塔防时代的说法,1.2 一个都不许留 */
const TOWER_WORDS = ["炮台", "路障", "棉花墙", "布防", "第几条道", "种下", "苗"];

function everyLine(): string[] {
  const out: string[] = [];
  for (let jars = 0; jars <= 9; jars++) out.push(arenaWinLine(jars, 9, 12));
  for (let w = 0; w <= 6; w++) out.push(arenaLoseLine(w, 6, w % LANES));
  out.push(arenaLoseLine(0, 6, -1));
  for (const [r, b] of [[0, 0], [3, 3], [2, 9], [12, 8]]) out.push(arenaEndlessLine(r, b));
  out.push(arenaCoopLine(10, 10, 40), arenaCoopLine(4, 10, 9));
  out.push(arenaVersusLine(-1, [3, 3], ["朵朵", "星星"]));
  out.push(arenaVersusLine(0, [4, 1], ["朵朵", "星星"]));
  out.push(arenaVersusLine(1, [0, 5], ["朵朵", "星星"]));
  out.push(draftTitle(1), draftTitle(4));
  return out;
}

describe("1.2 文案红线", () => {
  it("所有结算话术都无血无伤无死亡", () => {
    for (const line of everyLine()) {
      expect(line.length, line).toBeGreaterThan(0);
      for (const word of BANNED) expect(line, `${word} @ ${line}`).not.toContain(word);
      expect(isClean(line)).toBe(true);
    }
  });

  it("没守住那几句只鼓励,而且一定给出下一步怎么做", () => {
    for (let w = 0; w <= 6; w++) {
      const line = arenaLoseLine(w, 6, w % LANES);
      expect(line).toMatch(/再来|下一次|下一局|一定/);
      // 「就差一点点」这类话得落到动作上,不能只喊口号
      expect(line).toMatch(/守|绕|退|站|按住|捡/);
    }
  });

  it("塔防时代的说法一个都不许留在结算里", () => {
    for (const line of everyLine()) {
      for (const word of TOWER_WORDS) expect(line, `${word} @ ${line}`).not.toContain(word);
    }
  });

  it("首页那句 blurb 说的是「自己上场」,不是 1.1 的摆路障架炮台", () => {
    expect(meta.blurb).not.toContain("路障");
    expect(meta.blurb).not.toContain("炮台");
    expect(meta.blurb).toContain("上场");
    expect(meta.blurb).toMatch(/成长卡|三选一/);
    for (const word of BANNED) expect(meta.blurb, word).not.toContain(word);
  });

  it("方向名和 arena 的扇区一一对应,越界了也有兜底说法", () => {
    expect(SECTOR_NAMES).toHaveLength(LANES);
    for (let i = 0; i < LANES; i++) expect(sectorName(i)).toBe(SECTOR_NAMES[i]);
    expect(sectorName(-1)).toBe("家门口");
    expect(sectorName(LANES)).toBe("家门口");
    expect(sectorName(NaN)).toBe("家门口");
  });

  it("过关那句会按丢了几罐换说法,满罐时点名一罐没丢", () => {
    expect(arenaWinLine(9, 9, 20)).toContain("一罐元气都没丢");
    expect(arenaWinLine(8, 9, 20)).toContain("只被抱走一罐");
    expect(arenaWinLine(3, 9, 20)).toContain("惊险");
  });

  it("无尽破纪录和没破纪录说的不是同一句", () => {
    const record = arenaEndlessLine(12, 12);
    const behind = arenaEndlessLine(5, 12);
    expect(record).toContain("新纪录");
    expect(behind).toContain("12");
    expect(record).not.toBe(behind);
  });

  it("对战平手不点名赢家,分出胜负时点名的是真赢的那边", () => {
    expect(arenaVersusLine(-1, [2, 2], ["朵朵", "星星"])).toContain("平手");
    expect(arenaVersusLine(0, [4, 0], ["朵朵", "星星"])).toContain("朵朵这边守得更稳");
    expect(arenaVersusLine(1, [0, 4], ["朵朵", "星星"])).toContain("星星这边守得更稳");
  });
});
