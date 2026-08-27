/**
 * 窗口 5 · 1.3 第 2 轮学习优化员 · 文案快照测试。
 *
 * 两件事:
 *  1. 钉住本轮新增的 9 处「视觉亮点入引导」文案(全部对应修复员 R1 真实落地的绘制行为,
 *     出处逐条登记在 docs/qa/1.3-window5-round2-learner.md 第六节);
 *  2. 钉住第 1 轮学习优化员的 5 处 guide/blurb 文案(bomb-buddies 更名已有
 *     copy13.test.ts 单独钉),防止后续 rebase / 改稿把它们冲掉而没人发现。
 *
 * 只读文案模块,零玩法零绘制;新增用例只增不减。
 */
import { describe, expect, it } from "vitest";
import snowFightGuide from "./snow-fight/guide";
import skySquadGuide from "./sky-squad/guide";
import puffBrosGuide from "./puff-bros/guide";
import bombBuddiesGuide from "./bomb-buddies/guide";
import bumperCarsGuide from "./bumper-cars/guide";
import iceFireForestGuide from "./ice-fire-forest/guide";
import princePrincessGuide from "./prince-princess/guide";
import shootRangeGuide from "./shoot-range/guide";
import bowlingLaneGuide from "./bowling-lane/guide";
import { meta as skySquadMeta } from "./sky-squad/meta";
import { meta as iceFireForestMeta } from "./ice-fire-forest/meta";
import type { GuideBook } from "../ui/level188Contract";

/** 整本攻略拍平成一段文字,便于「某句话在不在」的快照断言 */
function flat(book: GuideBook): string {
  return [
    book.title,
    ...book.general,
    ...book.entries.flatMap((e) => [e.title, ...e.tips]),
  ].join("\n");
}

describe("窗口5 R2 学习优化员 · 本轮 9 处视觉亮点文案在位", () => {
  it("snow-fight:溅雪命中回执 + 雪怪第三帽形(修复员 S5/G3 落地)", () => {
    const s = flat(snowFightGuide);
    expect(s).toContain("命中的回执");
    expect(s).toContain("深青色毛线帽");
  });

  it("sky-squad:拾取物专属色圈双通道识别(修复员 S7 落地)", () => {
    expect(flat(skySquadGuide)).toContain("先认色圈、再认图案");
  });

  it("puff-bros:四型糖果与泡泡的防混淆剪影(修复员 S6 落地)", () => {
    const s = flat(puffBrosGuide);
    expect(s).toContain("糖果有四副模样");
    expect(s).toContain("圆滚滚会飘的才是泡泡");
  });

  it("bomb-buddies:泡泡王头顶层数圆牌语义(修复员 S4 落地)", () => {
    expect(flat(bombBuddiesGuide)).toContain("数字就是它还剩几层");
  });

  it("bumper-cars:台沿 = 浅蓝冰断面出局线(修复员 G10/12 系落地)", () => {
    expect(flat(bumperCarsGuide)).toContain("浅蓝冰断面");
  });

  it("ice-fire-forest:门面徽章认门 + 挂锁锁弓开闩(修复员 G2 落地)", () => {
    const s = flat(iceFireForestGuide);
    expect(s).toContain("水滴、火苗小徽章");
    expect(s).toContain("锁弓一抬起来");
  });

  it("prince-princess:铠甲怪前置小圆盾识别件(修复员 S1 落地)", () => {
    expect(flat(princePrincessGuide)).toContain("端着一面小圆盾");
  });

  it("shoot-range:奖品架是布景不是靶(修复员 12a 落地)", () => {
    expect(flat(shootRangeGuide)).toContain("奖品架,只是布景");
  });

  it("bowling-lane:邻道暗剪影是布景,盯自己的亮道(修复员 12c 落地)", () => {
    expect(flat(bowlingLaneGuide)).toContain("隔壁球道和立柱的影子");
  });
});

describe("窗口5 R2 学习优化员 · 第 1 轮文案防冲掉(rebase 防线)", () => {
  it("R1 五处 guide/blurb 亮点文案全部仍在位", () => {
    expect(skySquadMeta.blurb).toContain("机翼下三层云海");
    expect(iceFireForestMeta.blurb).toContain("一半冰蓝一半暖橙");
    expect(flat(shootRangeGuide)).toContain("要溜走的信号");
    expect(flat(princePrincessGuide)).toContain("粉红小三角");
    expect(flat(bumperCarsGuide)).toContain("流光跑道");
    expect(flat(bombBuddiesGuide)).toContain("砖面裂出细纹");
  });
});

describe("窗口5 R2 学习优化员 · 新增文案分级红线自查", () => {
  it("九本攻略全文无「血 / 死亡」字样,失败语境只鼓励", () => {
    const books = [
      snowFightGuide, skySquadGuide, puffBrosGuide, bombBuddiesGuide, bumperCarsGuide,
      iceFireForestGuide, princePrincessGuide, shootRangeGuide, bowlingLaneGuide,
    ];
    for (const b of books) expect(flat(b)).not.toMatch(/血|死亡/);
  });
});
