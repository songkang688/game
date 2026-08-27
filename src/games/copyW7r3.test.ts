/**
 * 窗口 7 · 第 3 轮(终验)视觉验收 · B 档学习优化员的文案快照(只钉文案,不碰玩法)。
 *
 * 终验轮文案终查只发现两处文案级问题,本文件把修后状态钉死:
 *  1. fishing-star blurb「收杆」→「收竿」:同句前半「抛竿」用竿、后半用杆,
 *     且本款 guide 写的是「完美收竿」——用户可见文案统一成「竿」;
 *  2. puzzle-tiles blurb 全角「，！」→ 半角「,!」:九款入口卡里唯一一处
 *     全角逗号/叹号,首页九卡并排时标点不齐——对齐其余八款。
 * 另把「九款 blurb 标点半角统一」钉成聚合断言,防后续新文案再混进全角逗号/叹号。
 */
import { describe, expect, it } from "vitest";
import { BABY_TALK_WORDS, BRAND_WORDS } from "./copy.test";

import fshGuide from "./fishing-star/guide";
import { meta as fcMeta } from "./fruit-catch/meta";
import { meta as fsMeta } from "./fruit-slice/meta";
import { meta as ssMeta } from "./snake-snack/meta";
import { meta as llkMeta } from "./lianliankan/meta";
import { meta as ptMeta } from "./puzzle-tiles/meta";
import { meta as mcMeta } from "./memory-cards/meta";
import { meta as ldMeta } from "./landlord-cards/meta";
import { meta as fshMeta } from "./fishing-star/meta";
import { meta as phMeta } from "./poop-hero/meta";

const NINE_METAS = [fcMeta, fsMeta, ssMeta, llkMeta, ptMeta, mcMeta, ldMeta, fshMeta, phMeta] as const;

describe("W7R3 · 文案终查修正 1:fishing-star 抛竿/收竿同字", () => {
  it("blurb 用「收竿」,不再出现「收杆」,与同句「抛竿」同字", () => {
    expect(fshMeta.blurb).toContain("抛竿");
    expect(fshMeta.blurb).toContain("收竿");
    expect(fshMeta.blurb.includes("收杆")).toBe(false);
  });

  it("guide 原有的「完美收竿」原样保留(本轮未动 guide)", () => {
    const text = [fshGuide.title, ...fshGuide.general, ...fshGuide.entries.flatMap((e) => [e.title, ...e.tips])].join("\n");
    expect(text).toContain("完美收竿");
  });

  it("R1 钉过的事实词(188 / 图鉴 / 钓到天黑)一个不丢", () => {
    expect(fshMeta.blurb).toContain("188");
    expect(fshMeta.blurb).toContain("图鉴");
    expect(fshMeta.blurb).toContain("钓到天黑");
  });
});

describe("W7R3 · 文案终查修正 2:puzzle-tiles blurb 标点半角化", () => {
  it("blurb 不再含全角逗号/叹号,R1/R2 钉过的两个短语原样保留", () => {
    expect(ptMeta.blurb.includes("，")).toBe(false);
    expect(ptMeta.blurb.includes("！")).toBe(false);
    expect(ptMeta.blurb).toContain("每关拼的都是一整幅手绘场景画");
    expect(ptMeta.blurb).toContain("拼块带纸纹齿边像真拼图");
    expect(ptMeta.blurb).toContain("188");
  });

  it("九款入口卡 blurb 标点半角统一(顿号「、」与引号不在此列)", () => {
    for (const m of NINE_METAS) {
      expect(m.blurb.includes("，"), `${m.id} blurb 混进了全角逗号`).toBe(false);
      expect(m.blurb.includes("！"), `${m.id} blurb 混进了全角叹号`).toBe(false);
    }
  });
});

describe("W7R3 · 修后文案照过商标 / 低幼黑名单(双保险)", () => {
  it("两条修过的 blurb 无商标词、无低幼词", () => {
    for (const text of [fshMeta.blurb, ptMeta.blurb]) {
      for (const w of BRAND_WORDS) expect(text.includes(w), `blurb 撞商标词「${w}」`).toBe(false);
      for (const w of BABY_TALK_WORDS) expect(text.includes(w), `blurb 撞低幼词「${w}」`).toBe(false);
    }
  });
});
