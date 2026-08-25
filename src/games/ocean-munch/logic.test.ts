import { describe, expect, it } from "vitest";
import {
  BOSS_INFO,
  BUBBLE_GAP,
  DEX,
  EEL_OFF,
  EEL_ON,
  HANDMADE_PER_THEME,
  HEARTS_PER_LEVEL,
  LEVELS,
  LEVELS_PER_THEME,
  SHIELD_SECONDS,
  START_RADIUS,
  VORTEX_RADIUS,
  ZONE_ORDER,
  ZONE_STYLE,
  bossBiteReady,
  canEat,
  circlesOverlap,
  clearSpeechLine,
  dexIdForFish,
  eatScore,
  eelActive,
  grow,
  hazardTier,
  inBubbleGap,
  isDanger,
  isLevelUnlocked,
  isThemeUnlocked,
  levelIndicesOfTheme,
  parseDex,
  parseProgress,
  retrySpeechLine,
  serializeDex,
  serializeProgress,
  spawnRadius,
  starsForLevel,
  themeCleared,
  themeOfLevel,
  themeStars,
  totalStars,
  vortexPull,
} from "./logic";

describe("ocean-munch 99 关九大海域", () => {
  it("正好 99 关 = 9 章 × 11 关", () => {
    expect(LEVELS.length).toBe(99);
    expect(ZONE_ORDER.length).toBe(9);
    expect(LEVELS_PER_THEME).toBe(11);
    expect(ZONE_ORDER.length * LEVELS_PER_THEME).toBe(99);
  });

  it("章内关卡海域一致,顺序与 ZONE_ORDER 对应", () => {
    for (let ci = 0; ci < ZONE_ORDER.length; ci++) {
      for (const li of levelIndicesOfTheme(ci)) {
        expect(LEVELS[li].zone).toBe(ZONE_ORDER[ci]);
        expect(themeOfLevel(li)).toBe(ZONE_ORDER[ci]);
      }
    }
  });

  it("每章至少 8 关手写(非生成)且布局互不相同", () => {
    for (let ci = 0; ci < ZONE_ORDER.length; ci++) {
      const hand = levelIndicesOfTheme(ci)
        .map((i) => LEVELS[i])
        .filter((l) => !l.gen);
      expect(hand.length).toBeGreaterThanOrEqual(HANDMADE_PER_THEME);
      // 手写关布局签名 = 障碍组合 + 目标大小 + BOSS
      const sigs = new Set(
        hand.map((l) => `${[...l.hazards].sort().join(",")}|${l.targetR}|${l.boss ?? "-"}`),
      );
      expect(sigs.size).toBe(hand.length);
    }
  });

  it("生成关卡的障碍组合不重复同一模板(全局唯一)", () => {
    const gens = LEVELS.filter((l) => l.gen);
    expect(gens.length).toBe(ZONE_ORDER.length * (LEVELS_PER_THEME - HANDMADE_PER_THEME));
    const sigs = new Set(gens.map((l) => `${l.zone}|${[...l.hazards].sort().join(",")}`));
    expect(sigs.size).toBe(gens.length);
  });

  it("生成关卡的障碍组合也不和同章手写关重复", () => {
    for (let ci = 0; ci < ZONE_ORDER.length; ci++) {
      const chapter = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      const handSigs = new Set(
        chapter.filter((l) => !l.gen).map((l) => [...l.hazards].sort().join(",")),
      );
      for (const g of chapter.filter((l) => l.gen)) {
        expect(handSigs.has([...g.hazards].sort().join(","))).toBe(false);
      }
    }
  });

  it("99 关每关都有全局唯一的机制标记", () => {
    const feats = new Set(LEVELS.map((l) => l.feature));
    expect(feats.size).toBe(99);
    for (const l of LEVELS) expect(l.feature.length).toBeGreaterThan(0);
  });

  it("九片海域配色两两不同,障碍组合(palette)两两不同", () => {
    const tops = new Set(ZONE_ORDER.map((z) => ZONE_STYLE[z].top));
    expect(tops.size).toBe(9);
    const bottoms = new Set(ZONE_ORDER.map((z) => ZONE_STYLE[z].bottom));
    expect(bottoms.size).toBe(9);
    const palettes = new Set(ZONE_ORDER.map((z) => [...ZONE_STYLE[z].palette].sort().join(",")));
    expect(palettes.size).toBe(9);
    for (const z of ZONE_ORDER) {
      expect(ZONE_STYLE[z].name).toBeTruthy();
      expect(ZONE_STYLE[z].top).toMatch(/^#/);
      expect(ZONE_STYLE[z].speedMult).toBeGreaterThan(0.8);
    }
  });

  it("战役覆盖全部 8 种障碍,越深的海域越湍急", () => {
    const hazards = new Set(LEVELS.flatMap((l) => l.hazards));
    expect(hazards.size).toBe(8);
    expect(ZONE_STYLE.pearl.speedMult).toBeGreaterThan(ZONE_STYLE.shallow.speedMult);
    expect(ZONE_STYLE.ice.speedMult).toBeGreaterThan(1);
    // 午夜深渊是黑暗海域
    expect(ZONE_STYLE.abyss.dark).toBe(true);
  });

  it("环境障碍密度随章节分三档", () => {
    expect(hazardTier(0)).toBe(1);
    expect(hazardTier(2 * LEVELS_PER_THEME)).toBe(1);
    expect(hazardTier(3 * LEVELS_PER_THEME)).toBe(2);
    expect(hazardTier(6 * LEVELS_PER_THEME)).toBe(3);
    expect(hazardTier(98)).toBe(3);
  });
});

describe("ocean-munch 九位海域 BOSS", () => {
  it("每章最后一关都是本海域专属 BOSS,九位互不相同", () => {
    const seen = new Set<string>();
    for (let ci = 0; ci < ZONE_ORDER.length; ci++) {
      const last = LEVELS[ci * LEVELS_PER_THEME + LEVELS_PER_THEME - 1];
      expect(last.boss).toBe(ZONE_STYLE[ZONE_ORDER[ci]].boss);
      seen.add(last.boss!);
    }
    expect(seen.size).toBe(9);
    expect(LEVELS[98].boss).toBe("dragon");
  });

  it("BOSS 血量沿章节不减,最终 BOSS 最多", () => {
    const hps = ZONE_ORDER.map((z) => BOSS_INFO[ZONE_STYLE[z].boss].hp);
    for (let i = 1; i < hps.length; i++) expect(hps[i]).toBeGreaterThanOrEqual(hps[i - 1]);
    expect(BOSS_INFO.dragon.hp).toBe(Math.max(...hps));
  });

  it("BOSS 技能组合至少 7 种不同", () => {
    const sigs = new Set(
      ZONE_ORDER.map((z) => {
        const s = BOSS_INFO[ZONE_STYLE[z].boss];
        return `${s.inks}|${s.summons ?? "-"}|${!!s.pulls}|${!!s.enrages}`;
      }),
    );
    expect(sigs.size).toBeGreaterThanOrEqual(7);
  });

  it("长到 BOSS 六成大才能咬", () => {
    expect(bossBiteReady(BOSS_INFO.whale.r * 0.5, BOSS_INFO.whale.r)).toBe(false);
    expect(bossBiteReady(BOSS_INFO.whale.r * 0.62, BOSS_INFO.whale.r)).toBe(true);
    expect(bossBiteReady(30, 40)).toBe(true);
  });
});

describe("ocean-munch 难度曲线", () => {
  it("每关目标都比初始大小大,目标整体随章节上升", () => {
    for (const l of LEVELS) expect(l.targetR).toBeGreaterThan(START_RADIUS);
    expect(LEVELS[0].hazards.length).toBe(0);
    const firstZoneMax = Math.max(...levelIndicesOfTheme(0).map((i) => LEVELS[i].targetR));
    const lastZoneMin = Math.min(...levelIndicesOfTheme(8).map((i) => LEVELS[i].targetR));
    expect(lastZoneMin).toBeGreaterThan(firstZoneMax);
  });

  it("大鱼概率随章节上升且有上限", () => {
    expect(LEVELS[0].bigFishBias).toBe(0);
    for (const l of LEVELS) expect(l.bigFishBias).toBeLessThanOrEqual(0.2);
    const early = LEVELS[3].bigFishBias;
    const late = LEVELS[92].bigFishBias;
    expect(late).toBeGreaterThan(early);
  });

  it("每章毕业关(第 10 关)障碍至少 3 种", () => {
    for (let ci = 1; ci < ZONE_ORDER.length; ci++) {
      const challenge = LEVELS[ci * LEVELS_PER_THEME + 9];
      expect(challenge.hazards.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("ocean-munch 吃鱼规则", () => {
  it("明显更大才能吃,明显更小才危险,差不多大平安无事", () => {
    expect(canEat(20, 15)).toBe(true);
    expect(canEat(20, 19.5)).toBe(false);
    expect(isDanger(20, 30)).toBe(true);
    expect(isDanger(20, 21)).toBe(false);
    expect(canEat(20, 21) || isDanger(20, 21)).toBe(false);
  });

  it("圆形碰撞有宽容度", () => {
    expect(circlesOverlap(0, 0, 10, 10, 0, 10)).toBe(true);
    expect(circlesOverlap(0, 0, 10, 30, 0, 10)).toBe(false);
  });

  it("吃鱼长大但不超过封顶", () => {
    expect(grow(20, 10, 48)).toBeGreaterThan(20);
    expect(grow(47.8, 30, 48)).toBe(48);
  });

  it("spawnRadius:小 roll 出小鱼,大 roll 出大鱼,bigBias 提高大鱼占比", () => {
    expect(spawnRadius(20, 0.1)).toBeLessThan(20);
    expect(spawnRadius(20, 0.95)).toBeGreaterThan(20);
    expect(spawnRadius(20, 0.6, 0.25)).toBeGreaterThan(20);
    expect(spawnRadius(20, 0.6, 0)).toBeLessThan(20);
  });

  it("连吃分数递增且封顶", () => {
    expect(eatScore(1)).toBe(10);
    expect(eatScore(2)).toBeGreaterThan(eatScore(1));
    expect(eatScore(8)).toBe(eatScore(20));
  });
});

describe("ocean-munch 障碍机制", () => {
  it("电电草按周期通电", () => {
    expect(EEL_ON).toBeGreaterThan(0);
    expect(EEL_OFF).toBeGreaterThan(0);
    expect(eelActive(0, 0)).toBe(true);
    expect(eelActive(EEL_ON + 0.1, 0)).toBe(false);
    expect(eelActive(EEL_ON + EEL_OFF + 0.05, 0)).toBe(true);
    // offset 让不同草错开
    expect(eelActive(0, EEL_ON + 0.1)).toBe(false);
  });

  it("涡流:越近吸力越强,涡外没有力", () => {
    const near = vortexPull(30, 0);
    const far = vortexPull(120, 0);
    expect(near.fx).toBeLessThan(0); // 指向涡心
    expect(Math.abs(near.fx)).toBeGreaterThan(Math.abs(far.fx));
    const out = vortexPull(VORTEX_RADIUS + 10, 0);
    expect(out.fx).toBe(0);
    expect(out.fy).toBe(0);
  });

  it("气泡墙:缺口内可以穿过", () => {
    expect(inBubbleGap(200, 200)).toBe(true);
    expect(inBubbleGap(200 + BUBBLE_GAP / 2 - 1, 200)).toBe(true);
    expect(inBubbleGap(200 + BUBBLE_GAP, 200)).toBe(false);
    expect(inBubbleGap(0, 300)).toBe(false);
  });

  it("护盾有时长", () => {
    expect(SHIELD_SECONDS).toBeGreaterThan(0);
  });
});

describe("ocean-munch 生物图鉴", () => {
  it("图鉴条目覆盖普通鱼、障碍生物和 9 个 BOSS", () => {
    expect(DEX.length).toBeGreaterThanOrEqual(16);
    const ids = new Set(DEX.map((d) => d.id));
    expect(ids.size).toBe(DEX.length);
    for (const z of ZONE_ORDER) {
      expect(ids.has(ZONE_STYLE[z].boss)).toBe(true);
    }
  });

  it("按相对大小归类吃到的鱼", () => {
    expect(dexIdForFish(5, 30)).toBe("minnow");
    expect(dexIdForFish(20, 30)).toBe("stripey");
    expect(dexIdForFish(29, 30)).toBe("bigblue");
  });

  it("图鉴可以序列化和恢复,坏档当新档", () => {
    const seen = new Set(["minnow", "jelly"]);
    const restored = parseDex(serializeDex(seen));
    expect(restored.has("minnow")).toBe(true);
    expect(restored.has("jelly")).toBe(true);
    expect(restored.size).toBe(2);
    expect(parseDex(null).size).toBe(0);
    expect(parseDex("oops").size).toBe(0);
    // 非法 id 被过滤
    expect(parseDex(JSON.stringify(["minnow", "fake-id"])).size).toBe(1);
  });
});

describe("ocean-munch 星级与进度", () => {
  it("不掉心 3 星,掉 1 颗 2 星,通过 1 星", () => {
    expect(HEARTS_PER_LEVEL).toBe(3);
    expect(starsForLevel(0)).toBe(3);
    expect(starsForLevel(1)).toBe(2);
    expect(starsForLevel(2)).toBe(1);
  });

  it("进度序列化往返一致,坏档当新档", () => {
    const stars = new Array(LEVELS.length).fill(0);
    stars[0] = 3;
    stars[1] = 2;
    const restored = parseProgress(serializeProgress(stars), LEVELS.length);
    expect(restored[0]).toBe(3);
    expect(restored[1]).toBe(2);
    expect(restored[2]).toBe(0);
    expect(parseProgress(null, 3)).toEqual([0, 0, 0]);
    expect(parseProgress("bad json", 3)).toEqual([0, 0, 0]);
    expect(parseProgress(JSON.stringify([9, -1]), 2)).toEqual([3, 0]);
  });

  it("第一关默认解锁,通过才解锁下一关", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isLevelUnlocked(stars, 0)).toBe(true);
    expect(isLevelUnlocked(stars, 1)).toBe(false);
    stars[0] = 1;
    expect(isLevelUnlocked(stars, 1)).toBe(true);
    stars[1] = 3;
    expect(totalStars(stars)).toBe(4);
  });

  it("章节解锁:通关上一章 BOSS 才开下一片海域", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isThemeUnlocked(stars, 0)).toBe(true);
    expect(isThemeUnlocked(stars, 1)).toBe(false);
    for (let i = 0; i < LEVELS_PER_THEME; i++) stars[i] = 2;
    expect(isThemeUnlocked(stars, 1)).toBe(true);
    expect(isThemeUnlocked(stars, 2)).toBe(false);
    expect(themeStars(stars, 0)).toBe(LEVELS_PER_THEME * 2);
    expect(themeCleared(stars, 0)).toBe(LEVELS_PER_THEME);
    expect(themeCleared(stars, 1)).toBe(0);
  });
});

describe("结算面板朗读文案", () => {
  it("三星夸完美,其余报星数和吃鱼数", () => {
    expect(clearSpeechLine("浅浅珊瑚湾", 3, 12)).toBe("浅浅珊瑚湾通过啦!三颗星,吃了 12 条鱼,完美!");
    expect(clearSpeechLine("浅浅珊瑚湾", 1, 8)).toBe("浅浅珊瑚湾通过啦!得到 1 颗星,吃了 8 条鱼,真棒!");
  });

  it("失败朗读温柔安抚,BOSS 关带悄悄提示", () => {
    expect(retrySpeechLine(null)).toBe("小鱼晕乎乎。没关系,这片海再游一次就好!");
    expect(retrySpeechLine("先绕开大墨团,再贴上去咬!")).toBe(
      "小鱼晕乎乎。没关系,这片海再游一次就好!悄悄告诉你:先绕开大墨团,再贴上去咬!"
    );
  });
});
