/**
 * 窗口 6 · 第 3 轮(终验) · B 档学习优化员 · 文案终查钉子。
 *
 * 终验轮文案终查抓到两处玩家可见文案带裸「血」字(全库分级红线是「无血」,
 * 库内既有守卫只封了流血/鲜血/血条/血量等组合词,漏了口语裸字):
 *  - adventure-king 星辉王座提示「把血拼光」→「把心用光」(与既有心得「心用完只是这一趟结束」同一套说法);
 *  - brick-break 通用心得「多血砖」→「多层砖」(logic.ts 玩法层本来就叫多层砖,玩家口径就地统一)。
 * 这里把两处改口钉住,并把「9 款玩家可见攻略/简介文案无裸『血』字、无恐吓词」
 * 升级成机器守卫,防后续文案回潮。只测文案,不 import 任何绘制或玩法代码。
 */
import { describe, expect, it } from "vitest";
import bravePath from "./brave-path/guide";
import adventureKing from "./adventure-king/guide";
import alienSeek from "./alien-seek/guide";
import brickBreak from "./brick-break/guide";
import molePop from "./mole-pop/guide";
import boxHamster from "./box-hamster/guide";
import balloonPop from "./balloon-pop/guide";
import bubblePop from "./bubble-pop/guide";
import bubbleAim from "./bubble-aim/guide";
import { meta as bravePathMeta } from "./brave-path/meta";
import { meta as adventureKingMeta } from "./adventure-king/meta";
import { meta as alienSeekMeta } from "./alien-seek/meta";
import { meta as brickBreakMeta } from "./brick-break/meta";
import { meta as molePopMeta } from "./mole-pop/meta";
import { meta as boxHamsterMeta } from "./box-hamster/meta";
import { meta as balloonPopMeta } from "./balloon-pop/meta";
import { meta as bubblePopMeta } from "./bubble-pop/meta";
import { meta as bubbleAimMeta } from "./bubble-aim/meta";
import type { GuideBook } from "../ui/level188Contract";

const BOOKS: readonly GuideBook[] = [
  bravePath,
  adventureKing,
  alienSeek,
  brickBreak,
  molePop,
  boxHamster,
  balloonPop,
  bubblePop,
  bubbleAim,
];

const BLURBS: ReadonlyArray<{ id: string; blurb: string }> = [
  bravePathMeta,
  adventureKingMeta,
  alienSeekMeta,
  brickBreakMeta,
  molePopMeta,
  boxHamsterMeta,
  balloonPopMeta,
  bubblePopMeta,
  bubbleAimMeta,
];

/** 一本攻略里的全部玩家可见文字(通用心得 + 各章标题与提示) */
function allLines(book: GuideBook): string[] {
  return [...book.general, ...book.entries.flatMap((e) => [e.title, ...e.tips])];
}

describe("窗口6 R3 学习优化员 · 文案终查钉子", () => {
  it("两处终查改口在位:冒险小王说「心」不说「血」,碰碰砖块叫「多层砖」", () => {
    const ak = allLines(adventureKing);
    expect(ak.some((l) => l.includes("把心用光"))).toBe(true);
    expect(ak.some((l) => l.includes("血"))).toBe(false);
    const bk = allLines(brickBreak);
    expect(bk.some((l) => l.includes("多层砖"))).toBe(true);
    expect(bk.some((l) => l.includes("多血砖"))).toBe(false);
  });

  it("9 款攻略玩家可见文案 0 个裸「血」字(含各章标题与提示)", () => {
    for (const book of BOOKS) {
      for (const line of allLines(book)) {
        expect(line.includes("血"), `${book.gameId} 文案带「血」字:${line}`).toBe(false);
      }
    }
  });

  it("9 款攻略与首页简介无恐吓词,失败语气只鼓励", () => {
    // 分级红线抽查词:恐吓 / 贬损向;商标黑名单在 r1/r2 钉子与 copy.test.ts 里另有全量巡检。
    const scare = ["恐怖", "吓人", "吓死", "完蛋", "惩罚", "胆小鬼", "真笨", "差劲", "废物"];
    const texts: Array<[string, string]> = [
      ...BOOKS.flatMap((b) => allLines(b).map((l): [string, string] => [b.gameId, l])),
      ...BLURBS.map((m): [string, string] => [m.id, m.blurb]),
    ];
    for (const [id, line] of texts) {
      for (const w of scare) {
        expect(line.includes(w), `${id} 文案踩恐吓词「${w}」:${line}`).toBe(false);
      }
    }
  });
});
