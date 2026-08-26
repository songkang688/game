// 保龄球小馆 · 188 关关卡表单测。
//
// 关卡表是纯数据生成器:同一关号永远给同一架瓶、同一个目标分。
// 这里把「八章合计 188 关」「目标分一路涨」「特殊瓶按章出场」这些
// 说好的事情逐条钉住,免得改配方的时候悄悄改坏了难度曲线。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import {
  ALL_LEVELS,
  CHAPTERS,
  buildEndlessFrame,
  buildLevel,
  buildVersus,
  chapterOfLevel,
  chapterStartLevel,
  endlessTarget,
  skillForChapter,
} from "./levels";
import { PIN_TRAITS, type PinKind } from "./logic";
import { PINS } from "./scoring";

describe("章节表", () => {
  it("八个章节,加起来正好 188 关", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL_LEVELS);
    expect(TOTAL_LEVELS).toBe(188);
  });

  it("每章都有中文名、表情、粉彩底色和一句说明", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThan(8);
      expect(ch.size).toBeGreaterThan(0);
    }
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });

  it("章节起点和「这一关属于第几章」对得上", () => {
    for (let c = 0; c < CHAPTERS.length; c++) {
      const start = chapterStartLevel(c);
      expect(chapterOfLevel(start)).toBe(c);
      expect(chapterOfLevel(start + CHAPTERS[c].size - 1)).toBe(c);
    }
    expect(chapterStartLevel(0)).toBe(0);
    expect(chapterOfLevel(TOTAL_LEVELS - 1)).toBe(CHAPTERS.length - 1);
  });
});

describe("闯关关卡", () => {
  it("188 关每一关都合法:瓶数、油量、目标分、格数都在范围里", () => {
    for (const i of ALL_LEVELS) {
      const lv = buildLevel(i);
      expect(lv.index).toBe(i);
      expect(lv.kinds.length).toBe(PINS);
      for (const k of lv.kinds) expect(PIN_TRAITS[k]).toBeDefined();
      expect(lv.oil).toBeGreaterThanOrEqual(0);
      expect(lv.oil).toBeLessThanOrEqual(1);
      expect(lv.frames).toBeGreaterThanOrEqual(2);
      expect(lv.frames).toBeLessThanOrEqual(4);
      expect(lv.target).toBeGreaterThan(0);
      // 目标分不能高到「每格全中」都够不着
      expect(lv.target).toBeLessThan(lv.frames * 30);
      expect(lv.hint.length).toBeGreaterThan(8);
    }
  });

  it("同一关跑两次拿到的是一模一样的关卡", () => {
    for (const i of [0, 37, 96, 187]) {
      expect(buildLevel(i)).toEqual(buildLevel(i));
    }
  });

  it("关号越界会被夹回 0..187", () => {
    expect(buildLevel(-5).index).toBe(0);
    expect(buildLevel(9999).index).toBe(TOTAL_LEVELS - 1);
    expect(buildLevel(3.4).index).toBe(3);
  });

  it("同一章里越往后目标分越高", () => {
    for (let c = 0; c < CHAPTERS.length; c++) {
      const start = chapterStartLevel(c);
      const end = start + CHAPTERS[c].size - 1;
      expect(buildLevel(end).target).toBeGreaterThan(buildLevel(start).target);
    }
  });

  it("整体难度是往上走的:最后一章的目标分远高于第一章", () => {
    expect(buildLevel(TOTAL_LEVELS - 1).target).toBeGreaterThan(buildLevel(0).target * 2);
    expect(buildLevel(TOTAL_LEVELS - 1).frames).toBeGreaterThan(buildLevel(0).frames);
  });

  it("前两章是干净的木瓶阵,不掺特殊瓶", () => {
    for (let i = 0; i < chapterStartLevel(2); i++) {
      expect(buildLevel(i).kinds.every((k) => k === "wood")).toBe(true);
    }
  });

  it("第三章往后每一关都有特殊瓶,而且提示里会说清是什么瓶", () => {
    for (let i = chapterStartLevel(2); i < TOTAL_LEVELS; i++) {
      const lv = buildLevel(i);
      const specials = lv.kinds.filter((k) => k !== "wood");
      expect(specials.length).toBeGreaterThan(0);
      expect(lv.hint).toContain(PIN_TRAITS[specials[0]].name);
    }
  });

  it("一关里只混一种特殊瓶,不会铁瓶冰瓶混着上", () => {
    for (const i of ALL_LEVELS) {
      const specials = new Set(buildLevel(i).kinds.filter((k) => k !== "wood"));
      expect(specials.size).toBeLessThanOrEqual(1);
    }
  });

  it("章内越往后特殊瓶越多,而且从来不会摆满十个", () => {
    for (let c = 2; c < CHAPTERS.length; c++) {
      const start = chapterStartLevel(c);
      const end = start + CHAPTERS[c].size - 1;
      const head = buildLevel(start).kinds.filter((k) => k !== "wood").length;
      const tail = buildLevel(end).kinds.filter((k) => k !== "wood").length;
      expect(tail).toBeGreaterThanOrEqual(head);
      expect(tail).toBeLessThan(PINS);
    }
  });

  it("油面挑战那一章的油确实比别的章厚", () => {
    const oily = buildLevel(chapterStartLevel(6)).oil;
    expect(oily).toBeGreaterThan(buildLevel(0).oil);
    expect(oily).toBeGreaterThanOrEqual(0.8);
  });

  it("每一章用的特殊瓶跟章节主题对得上", () => {
    const want: Array<PinKind | null> = [null, null, "iron", "ice", "spring", "balloon", "iron", "iron"];
    want.forEach((kind, c) => {
      if (!kind) return;
      const lv = buildLevel(chapterStartLevel(c) + 3);
      expect(lv.kinds).toContain(kind);
    });
  });
});

describe("双人对战球道", () => {
  it("对战永远是整整十格", () => {
    for (let r = 1; r <= 12; r++) expect(buildVersus(r).frames).toBe(10);
  });

  it("五张球道轮着来,名字和油量都不一样", () => {
    const names = new Set<string>();
    for (let r = 1; r <= 5; r++) names.add(buildVersus(r).name);
    expect(names.size).toBe(5);
    expect(buildVersus(6).name).toBe(buildVersus(1).name);
  });

  it("每张球道的瓶阵合法,提示也写清楚了", () => {
    for (let r = 1; r <= 8; r++) {
      const vs = buildVersus(r);
      expect(vs.kinds.length).toBe(PINS);
      expect(vs.oil).toBeGreaterThan(0);
      expect(vs.oil).toBeLessThanOrEqual(1);
      expect(vs.hint.length).toBeGreaterThan(8);
    }
  });

  it("局号越界不会炸", () => {
    expect(buildVersus(0).name).toBe(buildVersus(1).name);
    expect(buildVersus(-3).frames).toBe(10);
  });
});

describe("无尽格", () => {
  it("目标分一路涨,但有上限,不会涨到打不完", () => {
    let prev = 0;
    for (let f = 1; f <= 60; f++) {
      const t = endlessTarget(f);
      expect(t).toBeGreaterThanOrEqual(prev);
      expect(t).toBeLessThanOrEqual(28);
      prev = t;
    }
    expect(endlessTarget(60)).toBeGreaterThan(endlessTarget(1));
  });

  it("越往后油越厚、特殊瓶越多", () => {
    const early = buildEndlessFrame(1);
    const late = buildEndlessFrame(30);
    expect(late.oil).toBeGreaterThan(early.oil);
    expect(late.kinds.filter((k) => k !== "wood").length).toBeGreaterThan(
      early.kinds.filter((k) => k !== "wood").length
    );
    expect(late.oil).toBeLessThanOrEqual(0.9);
  });

  it("第 1 格是干净的木瓶阵,让人先热身", () => {
    const first = buildEndlessFrame(1);
    expect(first.kinds.every((k) => k === "wood")).toBe(true);
    expect(first.target).toBe(endlessTarget(1));
  });

  it("同一格每次生成都一样,特殊瓶也从来不超过五个", () => {
    for (const f of [1, 7, 22, 99]) {
      expect(buildEndlessFrame(f)).toEqual(buildEndlessFrame(f));
      expect(buildEndlessFrame(f).kinds.filter((k) => k !== "wood").length).toBeLessThanOrEqual(5);
    }
  });
});

describe("陪练档位", () => {
  it("章节越靠后陪练越强,而且只有三档", () => {
    const skills = CHAPTERS.map((_, c) => skillForChapter(c));
    expect(skills[0]).toBe(1);
    expect(skills[skills.length - 1]).toBe(3);
    for (let i = 1; i < skills.length; i++) expect(skills[i]).toBeGreaterThanOrEqual(skills[i - 1]);
    for (const s of skills) expect([1, 2, 3]).toContain(s);
  });
});
