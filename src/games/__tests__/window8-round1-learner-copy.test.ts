/**
 * 窗口 8 · 1.3 视觉升级 · 第 1 轮学习优化员的文案快照（B 档新增）。
 *
 * 本轮把 12 款的新视觉亮点讲进了引导文案（guide / blurb）。这里做两件事：
 *  ① 快照钉死：每处新文案的关键句在位——防止后续轮次把视觉线索改丢；
 *  ② 文案 ↔ 视觉一致性：文案里说的颜色 / 形状 / 机制，必须与视觉常量对得上
 *    （例如「蓝色呼吸点」必须真的是蓝色、「橙色声母票」必须真的用橙色条）。
 * 只读断言，不碰任何玩法与绘制实现。
 */
import { describe, expect, it } from "vitest";
import { COLOR_FACE } from "../red-blue-tap/rounds";
import { BEAT_RING_MAX, BEAT_RING_MIN } from "../red-blue-tug/theater";
import { CLK_TOKENS, HOUR_HAND_SHAPE, MINUTE_HAND_SHAPE } from "../clock-house/house";
import { BASKET_UNIT } from "../../art/kit/crops";
import { TRAIN_COLORS } from "../../art/kit/train";
import { WG_TOKENS } from "../word-garden/inkArt";
import { CASTLE_SEGMENTS, litSegments } from "../shape-kingdom/kingdom";
import { FDF_ART, badgeLights } from "../find-diff/stage13";
import { RAINBOW, lumaOfHex, noteColorByMidi } from "../music-stars/starTheme";

import raceGuide from "../red-blue-race/guide";
import { meta as raceMeta } from "../red-blue-race/meta";
import tapGuide from "../red-blue-tap/guide";
import tugGuide from "../red-blue-tug/guide";
import clockGuide from "../clock-house/guide";
import farmGuide from "../math-farm/guide";
import pinyinGuide from "../pinyin-train/guide";
import gardenGuide from "../word-garden/guide";
import shapeGuide from "../shape-kingdom/guide";
import diffGuide from "../find-diff/guide";
import colorGuide from "../color-fun/guide";
import musicGuide from "../music-stars/guide";
import kittyGuide from "../kitty-care/guide";
import type { GuideBook } from "../../ui/level188Contract";

/** 整本攻略摊平成一串文本（通用心得 + 全部章节提示） */
function allText(book: GuideBook): string {
  return [
    ...book.general,
    ...book.entries.flatMap((e) => [e.title, ...e.tips]),
  ].join("\n");
}

/** 十六进制色的 RGB 三元组 */
function rgbOf(hex: string): [number, number, number] {
  const raw = hex.replace(/^#/, "");
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

describe("窗口8 · 学习优化员文案快照：12 款视觉线索句在位", () => {
  it("red-blue-race：起跑三盏灯（红红绿）讲进了攻略,立体赛道讲进了 blurb", () => {
    expect(allText(raceGuide)).toContain("三盏小灯");
    expect(allText(raceGuide)).toContain("绿灯亮起");
    expect(raceMeta.blurb).toContain("立体赛道");
    expect(raceMeta.blurb).toContain("格纹拱门");
  });

  it("red-blue-tap：颜色↔形状双通道讲进了攻略", () => {
    expect(allText(tapGuide)).toContain("专属形状");
    expect(allText(tapGuide)).toContain("分不清颜色看形状");
  });

  it("red-blue-tug：节拍金环「缩到最小 = 拍点」讲进了攻略", () => {
    const text = allText(tugGuide);
    expect(text).toContain("金色光环");
    expect(text).toContain("缩到最小");
  });

  it("clock-house：时针/分针的颜色与胖瘦讲进了攻略", () => {
    const text = allText(clockGuide);
    expect(text).toContain("短粗针是时针");
    expect(text).toContain("细长针才是分针");
  });

  it("math-farm：作物配图与「一筐装十个」讲进了攻略", () => {
    const text = allText(farmGuide);
    expect(text).toContain("作物图");
    expect(text).toContain("一筐装十个");
  });

  it("pinyin-train：车票三色分类讲进了攻略", () => {
    const text = allText(pinyinGuide);
    expect(text).toContain("橙色条是声母票");
    expect(text).toContain("青绿条是韵母票");
    expect(text).toContain("紫色条是整体认读票");
  });

  it("word-garden：描红起笔点从「红圆点」改成了「淡蓝呼吸点」并补了箭头预演", () => {
    const text = allText(gardenGuide);
    expect(text).not.toContain("红圆点");
    // 「蓝色」是形近字字库的答案词,攻略不许点名,所以文案用「淡蓝」
    expect(text).not.toContain("蓝色");
    expect(text).toContain("淡蓝呼吸点");
    expect(text).toContain("淡蓝小箭头");
  });

  it("shape-kingdom：城堡剪影进度条讲进了作图关攻略", () => {
    const text = allText(shapeGuide);
    expect(text).toContain("城堡剪影就是进度条");
    expect(text).toContain("六段全亮");
  });

  it("find-diff：金圈常亮与侦探徽章进度讲进了攻略", () => {
    const text = allText(diffGuide);
    expect(text).toContain("金圈");
    expect(text).toContain("侦探徽章");
  });

  it("color-fun：按号涂色的调色盘呼吸提示讲进了攻略", () => {
    expect(allText(colorGuide)).toContain("呼吸发亮");
  });

  it("music-stars：彩虹音阶（do 红 → si 紫、高八度更亮）讲进了攻略", () => {
    const text = allText(musicGuide);
    expect(text).toContain("do 的红");
    expect(text).toContain("si 的紫");
    expect(text).toContain("高八度会更亮");
  });

  it("kitty-care：耳朵/眼睛的心情表讲进了攻略", () => {
    const text = allText(kittyGuide);
    expect(text).toContain("耳朵耷平");
    expect(text).toContain("眼睛弯成月牙");
    expect(kittyGuide.general.length).toBeLessThanOrEqual(6);
  });
});

describe("窗口8 · 学习优化员文案 ↔ 视觉一致性（文案说的必须是画出来的）", () => {
  it("tap 文案的「蓝圆红方黄三角绿花」与 COLOR_FACE 形状表逐字对上", () => {
    expect(COLOR_FACE.blue.shape).toBe("●");
    expect(COLOR_FACE.red.shape).toBe("■");
    expect(COLOR_FACE.yellow.shape).toBe("▲");
    expect(COLOR_FACE.green.shape).toBe("✿");
  });

  it("tug 文案的「光环越缩越小」与节拍环半径常量方向一致", () => {
    expect(BEAT_RING_MAX).toBeGreaterThan(BEAT_RING_MIN);
  });

  it("clock 文案的「橙色短粗 / 蓝绿细长」与指针 token 及造型一致", () => {
    // 时针橙、分针青绿：橙 = 红分量明显大于蓝，青绿 = 蓝绿分量明显大于红
    const [hr, , hb] = rgbOf(CLK_TOKENS.hourOrange);
    const [mr, mg, mb] = rgbOf(CLK_TOKENS.minuteTeal);
    expect(hr).toBeGreaterThan(hb);
    expect(Math.max(mg, mb)).toBeGreaterThan(mr);
    // 「短粗 / 细长」：时针杆宽 > 分针杆宽
    expect(HOUR_HAND_SHAPE.shaftHalf).toBeGreaterThan(MINUTE_HAND_SHAPE.shaftHalf);
  });

  it("farm 文案的「一筐装十个」与 kit 的筐子约定一致", () => {
    expect(BASKET_UNIT).toBe(10);
  });

  it("pinyin 文案的三种票色与 TRAIN_COLORS 的色相族一致", () => {
    const [ir, , ib] = rgbOf(TRAIN_COLORS.initialOrange);
    expect(ir).toBeGreaterThan(ib); // 声母票是暖橙
    const [fr, fg, fb] = rgbOf(TRAIN_COLORS.finalTeal);
    expect(Math.max(fg, fb)).toBeGreaterThan(fr); // 韵母票是青绿
    const [wr, wg, wb] = rgbOf(TRAIN_COLORS.wholePurple);
    expect(wr).toBeGreaterThan(wg); // 整体认读票是紫（红蓝都压过绿）
    expect(wb).toBeGreaterThan(wg);
  });

  it("garden 文案的「蓝色呼吸点」真的是蓝色（guideBlue 蓝分量最大）", () => {
    const [r, g, b] = rgbOf(WG_TOKENS.guideBlue);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("shape 文案的「六段全亮」与城堡段数及进度映射一致", () => {
    expect(CASTLE_SEGMENTS).toBe(6);
    expect(litSegments(1)).toBe(6);
    expect(litSegments(0)).toBe(0);
  });

  it("diff 文案的「金圈 / 徽章点亮」与视觉 token 及点亮表一致", () => {
    const [r, g, b] = rgbOf(FDF_ART.foundGold);
    expect(r).toBeGreaterThan(b); // 金圈是暖金色
    expect(g).toBeGreaterThan(b);
    expect(badgeLights(2, 5)).toEqual([true, true, false, false, false]);
  });

  it("music 文案的「do 红 → si 紫、高八度更亮」与彩虹音阶映射一致", () => {
    const [dr, , db] = rgbOf(RAINBOW[0]);
    expect(dr).toBeGreaterThan(db); // do 是红
    const [sr, sg, sb] = rgbOf(RAINBOW[6]);
    expect(sb).toBeGreaterThan(sg); // si 是紫
    expect(sr).toBeGreaterThan(sg);
    // 高八度（+12）确实比中央八度亮
    expect(lumaOfHex(noteColorByMidi(72))).toBeGreaterThan(lumaOfHex(noteColorByMidi(60)));
  });
});
