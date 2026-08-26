/**
 * 王子公主大冒险 · 攻略。
 *
 * 和别的游戏一样走 `src/ui/guide.ts` 的 `src/games/<id>/guide.ts` 懒加载约定;
 * index.ts 直接 import 这一本,所以关卡里翻到的和攻略抽屉里翻到的永远是同一份文字。
 *
 * 关卡区间按 `levels.ts` 的 CHAPTERS 尺寸算出来,章节大小改了不用回来改数字。
 * 第一章关数最多(28 关),拆成「先分清谁打谁」和「练配合」两段,读起来有台阶。
 */
import type { GuideBook } from "../../ui/level188Contract";
import { CHAPTERS } from "./levels";
import { meta } from "./meta";

/** 每一章的起止关号(从 1 数起) */
function chapterRanges(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let from = 1;
  for (const ch of CHAPTERS) {
    out.push([from, from + ch.size - 1]);
    from += ch.size;
  }
  return out;
}

/** 第 2 章往后每章一组提示,和 CHAPTERS 一一对应 */
const LATER_TIPS: string[][] = [
  [
    "蝙蝠飞得高,王子要跳起来才砍得到,交给公主省事得多。",
    "公主在半空中还能再蹬一下,够高台就靠这一下二段跳。",
    "空中平台上的宝石顺路捡,三颗星里有一颗看的就是宝石数。",
  ],
  [
    "铠甲怪头顶写着「只有剑打得动」,星星会被壳弹开,别浪费时间。",
    "炮台吐弹是有节奏的,数着它的间隔冲上去最安全。",
    "打不动的怪不要硬碰,让搭档来,自己先躲开。",
  ],
  [
    "浮台是飘的,等它飘到脚边再跳,别在半空追。",
    "断口都是按王子的一段跳设计的,他跳得过去,公主更没问题。",
    "掉下去只丢一颗心,不会直接输,别慌。",
  ],
  [
    "尖刺踩上去就掉心,看到红色的一排就提前起跳。",
    "火球是直线飞的,跳一下或者站到平台上就躲开了。",
    "这一章怪多,先清掉挡路的,再回头捡宝石。",
  ],
  [
    "冰面上松开方向键还会往前溜一段,提前一点点松手。",
    "幽灵头顶写着「只有星星打得动」,剑会从它身上穿过去。",
    "滑地板上别贴着怪走,溜过头就撞上去了。",
  ],
  [
    "前面学过的怪这一章全都有,开局先看清楚谁在场,想好谁负责哪一只。",
    "首领的护甲会来回换颜色,画面顶上会写清楚这会儿该谁上。",
    "一个人玩的时候记得按 Tab 换人,换成打得动的那一位。",
  ],
];

function build(): GuideBook {
  const ranges = chapterRanges();
  const [firstFrom, firstTo] = ranges[0];
  const mid = firstFrom + Math.floor((firstTo - firstFrom) / 2);
  const first = CHAPTERS[0];

  /** 每章中段和章末各一场首领战,关号跟着章节尺寸走 */
  const bossLine = (from: number, to: number, size: number) =>
    `本章第 ${from + Math.floor(size / 2)} 关和第 ${to} 关各有一场首领战。`;

  return {
    gameId: meta.id,
    title: "冒险小攻略",
    general: [
      "王子近战、公主远程,遇到打不动的怪就换人,别硬碰。",
      "怪头顶的小图标已经写明了该谁上:写着「剑」的找王子,写着「星」的找公主。",
      "两个人共用一条心条,替对方挡一下是划算的。",
      "三颗星看的是清怪、用时、宝石三样,先求过关,再回头刷成绩。",
      "一个人玩就按 Tab 换人,没被操作的那位会自己跟上来帮忙。",
    ],
    entries: [
      {
        from: firstFrom,
        to: mid,
        title: `${first.emoji} ${first.name} · 先分清谁打谁`,
        tips: [
          "王子的剑够不远但一下很疼,贴近了再挥;公主的星星会自己找目标,站远点放最安全。",
          "跳到果冻怪头上踩一下也能把它弹开,还会顺势弹得很高。",
          "两个人共用一条心条,一个人挨了打,另一个人也会跟着无敌一小会儿。",
        ],
      },
      {
        from: mid + 1,
        to: firstTo,
        title: `${first.emoji} ${first.name} · 练配合`,
        tips: [
          "城门上会写还差几只才开,不用把每一只都打完也能过关。",
          "宝石不只在路上,平台顶上和断口对面各有一颗,顺路拐一下就拿到。",
          bossLine(firstFrom, firstTo, first.size),
        ],
      },
      ...CHAPTERS.slice(1).map((ch, i) => {
        const [from, to] = ranges[i + 1];
        return {
          from,
          to,
          title: `${ch.emoji} ${ch.name}`,
          tips: [...(LATER_TIPS[i] ?? [ch.desc]), bossLine(from, to, ch.size)],
        };
      }),
    ],
  };
}

const guide: GuideBook = build();
export default guide;
