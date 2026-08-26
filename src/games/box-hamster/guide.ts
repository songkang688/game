/**
 * 推箱小仓鼠 · 攻略(1.1 第 12 步)。
 *
 * 攻略正文从 index.ts 里搬到这里,和别的游戏一样走
 * `src/ui/guide.ts` 的 `src/games/<id>/guide.ts` 懒加载约定;index.ts 直接 import 这一本,
 * 所以关卡里翻到的和攻略抽屉里翻到的永远是同一份文字。
 *
 * 关卡区间是按 `levels.ts` 的章节尺寸算出来的,章节改了不用回来改数字。
 * 第一章关数最多,拆成「先认规矩」和「练手感」两段,读起来更有台阶。
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
    "箱子多的时候,先推那个离出口最远、最容易被别的箱子挡住的。",
    "一条走廊里并排放着两个箱子,先把靠里的那个挪走,外面的随时还能动。",
    "推之前在心里数一数:推完这一下,我还绕得到它另一边吗?",
  ],
  [
    "拐弯要花两步:先把箱子推到拐角,再绕到另一边接着推,别指望一口气拐过去。",
    "地窖里空地少,尽量别把箱子停在只剩一格宽的过道中间,那样两边都堵。",
    "四个箱子的关先解决角落那两个,中间的留到最后,选择最多。",
  ],
  [
    "踩上冰面会一直滑到滑不动为止,起脚前先顺着那条线看清楚会停在哪儿。",
    "箱子在冰上滑到脚印会「咔」地停住 —— 所以对准脚印所在的那一行或那一列推就对了。",
    "推箱子的时候仓鼠抓着箱子,自己不打滑,站在冰边推是安全的。",
  ],
  [
    "两个漩涡是一对。先自己走上去试一次,记住会被送到哪一格,再规划箱子的路线。",
    "箱子被推进漩涡也会被送走,而且只送一次,不会接着连传。",
    "对面那格如果已经被箱子占着,传送就不会发生,箱子会停在漩涡上,这一点可以拿来当刹车。",
  ],
  [
    "两只仓鼠一人一间屋,按「换鼠」或者键盘 Tab 换人,两边都归位才算过关。",
    "一边推不动了先别硬来,切到另一边推两步,常常回头就有新位置站了。",
    "两只仓鼠互相不挡路,但箱子挡谁都算数,分工的时候按箱子来分。",
  ],
  [
    "最后一章前面的机关轮着上,开局先看关卡标签写了哪几样,心里有底再动手。",
    "机关多的关先用眼睛走一遍全程,想好了再落第一步,能省下一大半步数。",
    "真的卡住了就点「提示」,它会亮出下一步该走的那一格,提示不扣星星。",
  ],
];

function build(): GuideBook {
  const ranges = chapterRanges();
  const [firstFrom, firstTo] = ranges[0];
  const mid = firstFrom + Math.floor((firstTo - firstFrom) / 2);
  const first = CHAPTERS[0];

  return {
    gameId: meta.id,
    title: "推箱小攻略",
    general: [
      "箱子只能推、不能拉,推进死角就救不回来了 —— 每一下都先想一步。",
      "撤销和重来都不扣星星,想到一半觉得不对就退回去,放心试。",
      "三颗星看的是步数,不是速度。停下来多看两眼,反而更省步。",
      "先在脑子里给每个箱子配一个脚印,再决定先推哪一个,顺序对了路就短。",
      "实在卡住就按「提示」,小仓鼠会亮出下一格该往哪儿走。",
    ],
    entries: [
      {
        from: firstFrom,
        to: mid,
        title: `${first.emoji} ${first.name} · 先认规矩`,
        tips: [
          "箱子只能推、不能拉。推之前先绕到它背后看看,那一格自己站得下吗?",
          "箱子一贴进墙角就再也出不来了,看到墙角就提前绕开。",
          "想不清楚就按「撤销」退回去,撤销不扣星星。",
        ],
      },
      {
        from: mid + 1,
        to: firstTo,
        title: `${first.emoji} ${first.name} · 练手感`,
        tips: [
          "把脚印当终点倒着想:箱子最后一下是从哪个方向推进去的,那一边就得留空。",
          "一个箱子贴着墙走的时候,只能顺着墙推,别把它推到墙的中段停下。",
          "开局先数一数箱子和脚印各几个,数目对上了再动手。",
        ],
      },
      ...CHAPTERS.slice(1).map((ch, i) => ({
        from: ranges[i + 1][0],
        to: ranges[i + 1][1],
        title: `${ch.emoji} ${ch.name}`,
        tips: LATER_TIPS[i] ?? [ch.desc],
      })),
    ],
  };
}

const guide: GuideBook = build();
export default guide;
