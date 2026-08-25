import { describe, expect, it } from "vitest";
import {
  BOSS_INFO,
  BUBBLE_GAP,
  DEX,
  EEL_OFF,
  EEL_ON,
  HEARTS_PER_LEVEL,
  LEVELS,
  SHIELD_SECONDS,
  START_RADIUS,
  VORTEX_RADIUS,
  ZONE_STYLE,
  bossBiteReady,
  canEat,
  circlesOverlap,
  dexIdForFish,
  eatScore,
  eelActive,
  grow,
  inBubbleGap,
  isDanger,
  isLevelUnlocked,
  parseDex,
  parseProgress,
  serializeDex,
  serializeProgress,
  spawnRadius,
  starsForLevel,
  totalStars,
  vortexPull,
} from "./logic";

describe("ocean-munch 战役关卡", () => {
  it("至少 18 关,覆盖四大海域", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(18);
    const zones = new Set(LEVELS.map((l) => l.zone));
    expect(zones.size).toBe(4);
    expect(zones.has("shallow")).toBe(true);
    expect(zones.has("coral")).toBe(true);
    expect(zones.has("deep")).toBe(true);
    expect(zones.has("ice")).toBe(true);
  });

  it("每关都有独特机制标记", () => {
    const feats = new Set(LEVELS.map((l) => l.feature));
    expect(feats.size).toBe(LEVELS.length);
    for (const l of LEVELS) expect(l.feature.length).toBeGreaterThan(0);
  });

  it("战役中至少引入 8 种障碍", () => {
    const hazards = new Set(LEVELS.flatMap((l) => l.hazards));
    expect(hazards.size).toBeGreaterThanOrEqual(8);
    expect(hazards.has("vortex")).toBe(true);
    expect(hazards.has("bubbleWall")).toBe(true);
    expect(hazards.has("eel")).toBe(true);
  });

  it("四片海域各有一个区域 BOSS,最终 BOSS 是鲸鲸", () => {
    const bosses = LEVELS.filter((l) => l.boss);
    expect(bosses.length).toBe(4);
    const kinds = new Set(bosses.map((l) => l.boss));
    expect(kinds.size).toBe(4);
    expect(LEVELS[LEVELS.length - 1].boss).toBe("whale");
  });

  it("BOSS 血量随海域递增", () => {
    expect(BOSS_INFO.crab.hp).toBeLessThan(BOSS_INFO.octopus.hp);
    expect(BOSS_INFO.octopus.hp).toBeLessThan(BOSS_INFO.angler.hp);
    expect(BOSS_INFO.angler.hp).toBeLessThan(BOSS_INFO.whale.hp);
  });

  it("每关目标都比初始大小大,难度元素逐步引入", () => {
    for (const l of LEVELS) expect(l.targetR).toBeGreaterThan(START_RADIUS);
    expect(LEVELS[0].hazards.length).toBe(0);
    expect(LEVELS[LEVELS.length - 2].hazards.length).toBeGreaterThanOrEqual(4);
  });

  it("四片海域都有配色", () => {
    expect(ZONE_STYLE.shallow.name).toBeTruthy();
    expect(ZONE_STYLE.coral.top).toMatch(/^#/);
    expect(ZONE_STYLE.deep.bottom).toMatch(/^#/);
    expect(ZONE_STYLE.ice.accent).toMatch(/^#/);
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

  it("长到 BOSS 六成大才能咬", () => {
    expect(bossBiteReady(BOSS_INFO.whale.r * 0.5, BOSS_INFO.whale.r)).toBe(false);
    expect(bossBiteReady(BOSS_INFO.whale.r * 0.62, BOSS_INFO.whale.r)).toBe(true);
    expect(bossBiteReady(30, 40)).toBe(true);
  });
});

describe("ocean-munch 新障碍机制", () => {
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
  it("图鉴条目覆盖普通鱼、障碍生物和 4 个 BOSS", () => {
    expect(DEX.length).toBeGreaterThanOrEqual(10);
    const ids = new Set(DEX.map((d) => d.id));
    expect(ids.size).toBe(DEX.length);
    for (const boss of ["crab", "octopus", "angler", "whale"]) {
      expect(ids.has(boss)).toBe(true);
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
});
