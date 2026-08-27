/**
 * 1.3 窗口 1 · 第 1 轮学习优化员 · 文案契约(只增不减)。
 *
 * 本轮把九款游戏 1.3 新视觉里**带玩法信息**的信号写进了攻略 general 段
 * (缩圈光点 / 围栏泛红 / 彩虹消行 / 座下光环 / 圈风罗盘 / 金骰子 /
 * 红黑双门与头像帽 / 落子涟漪与提子花瓣 / 四款尾翼)。
 * 这里逐款断言关键短语仍在,防止后续轮次把「视觉信号 → 玩法含义」的
 * 讲解改丢;短语与绘制实现的对应关系登记在
 * `docs/qa/1.3-window1-round1-learner.md` 第五节。
 * 商标与低幼措辞由 `src/games/copy.test.ts` 全量自动巡检,这里不重复。
 */
import { describe, expect, it } from "vitest";
import type { GuideBook } from "../ui/level188Contract";

import orbArenaGuide from "./orb-arena/guide";
import snakeRoyaleGuide from "./snake-royale/guide";
import blockDropGuide from "./block-drop/guide";
import comboClashGuide from "./combo-clash/guide";
import mahjongBloomGuide from "./mahjong-bloom/guide";
import starEstateGuide from "./star-estate/guide";
import heroCardsGuide from "./hero-cards/guide";
import weiqiGardenGuide from "./weiqi-garden/guide";
import flightChessGuide from "./flight-chess/guide";

/** 每款要求 general 段里仍然讲着这些视觉信号(子串匹配) */
const VISUAL_CUES: ReadonlyArray<{ guide: GuideBook; cues: readonly string[] }> = [
  // 缩圈信号(art.ts drawZone 的绕行光点)+ 双人金星/银月头饰(crestOf)
  { guide: orbArenaGuide, cues: ["小光点", "金色小星星", "银色小月牙"] },
  // 围栏逼近泛红(art.ts drawFence warn 段)+ 红蝴蝶结/蓝棒球帽(accessoryFor)
  { guide: snakeRoyaleGuide, cues: ["泛红", "红蝴蝶结", "蓝棒球帽"] },
  // 四消彩虹边(art.ts drawRainbowEdge)+ 47 关换井壁主题(themeForLevel)
  { guide: blockDropGuide, cues: ["彩虹光", "木箱花园", "星夜积木"] },
  // 座下光环红蓝双色(art.ts AURA_COLORS)+ 头饰互异(hatFront/hatBack)
  { guide: comboClashGuide, cues: ["珊瑚红", "天空蓝", "帽子"] },
  // 圈风罗盘(tileart.ts compassSVG + index.ts windCompassEl)
  { guide: mahjongBloomGuide, cues: ["罗盘", "圈风"] },
  // 对子金骰子(art.ts dieSVG gold + economy.ts doublesRun)
  { guide: starEstateGuide, cues: ["金骰子", "小黑屋"] },
  // 花色红黑双门(cardart.ts SUIT_ART)+ 十四款头像帽(hatInner)
  { guide: heroCardsGuide, cues: ["暖红色", "墨黑色", "帽子"] },
  // 落子涟漪(art.ts drawPlaceRipple)+ 提子花瓣(drawPetalBurst)
  { guide: weiqiGardenGuide, cues: ["涟漪", "花瓣"] },
  // 四款尾翼剪影(art.ts FIN_NAMES/finSVG)
  { guide: flightChessGuide, cues: ["圆鳍", "双叉鳍", "燕尾鳍"] }
];

describe("窗口1 · 第 1 轮学习优化员 · 视觉信号讲进攻略(guide.general)", () => {
  for (const { guide, cues } of VISUAL_CUES) {
    it(`${guide.gameId} 的 general 段保留视觉信号讲解`, () => {
      const text = guide.general.join("\n");
      for (const cue of cues) {
        expect(text, `${guide.gameId} 应讲到「${cue}」`).toContain(cue);
      }
    });
  }

  it("视觉信号以追加/并句方式进入 general,不挤掉原有条目(每款 general 恰为全库上限 6 条)", () => {
    for (const { guide } of VISUAL_CUES) {
      expect(guide.general.length, guide.gameId).toBe(6);
    }
  });
});
