/**
 * 窗口4 · 档B · 第 3 轮监督修复员 —— 收官复核。
 *
 * 两件事:
 * 1. 收掉本轮测试员登记的 **B3-01**(`fruit-slice` 没照顾 `prefers-reduced-motion`);
 * 2. 站在「复核者」的位置,把本轮学习优化员落地的 4 条一条条回看:
 *    加压不能加成断路,加花样不能加出红线。
 * 最后把五款的硬约束再整体扫一遍,作为发布前的总闸。
 */
import { describe, expect, it } from "vitest";
import {
  DOCK_B_GAMES,
  inlineCss,
  joinSources,
  mountFunctionsReturnDestroy,
  overflowingRules,
  rafBalanced,
  readGameFile,
  readGameSources,
  respectsReducedMotion,
  saveKeysIn,
  scanAudioMisuse,
  scanExternalDeps,
  scanRatingWords,
  scanTrademarks,
} from "./qaAudit";
import {
  RUINS_ENEMY_SPEED_MAX,
  RUINS_HEART_FLOOR,
  buildEndlessFloor,
  levelTraversable,
  ruinsPressure,
} from "./levels";
import { botPlay } from "./sim";

describe("档B R3 修复 · B3-01:切水果补上 prefers-reduced-motion", () => {
  const src = readGameFile("fruit-slice", "index.ts");

  it("真读了媒体查询,不是只在注释里提一句", () => {
    expect(src).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(src).toContain("reducedMotion");
  });

  it("压下去的是纯装饰:拖尾、迸溅、光圈、飘分、彩虹刀", () => {
    // 拖尾短一截
    expect(src).toContain("TRAIL_MAX");
    expect(src).toContain("TRAIL_SEC");
    // 迸溅/光圈收得快
    expect(src).toContain("FX_FADE");
    expect(src).toMatch(/splashes\[i\]\.life -= dt \* FX_FADE/);
    expect(src).toMatch(/rings\[i\]\.life -= rawDt \* FX_FADE/);
    // 飘分不再往上飘,但还在(分数得读得到)
    expect(src).toContain("if (!reducedMotion) floats[i].y -= rawDt * 32");
    // 彩虹刀不再逐帧刷色相(那是闪烁)
    expect(src).toContain("reducedMotion ? 0 : time * 200");
  });

  it("玩法一个字没动:抛物线、判定、计时都不看这面开关", () => {
    // 只有这几处装饰用到 reducedMotion / FX_FADE / TRAIL_*,没有别的
    const hits = src.match(/reducedMotion|FX_FADE|TRAIL_MAX|TRAIL_SEC/g) ?? [];
    expect(hits.length, "减弱动效的开关渗进了太多地方,得回看是不是碰到玩法了").toBeLessThan(20);
    // 重力、判定走廊、发射节奏这些名字附近不许出现这面开关
    for (const line of src.split("\n")) {
      if (!/reducedMotion|FX_FADE/.test(line)) continue;
      expect(line, `这一行把减弱动效接到玩法上了:${line.trim()}`).not.toMatch(
        /gravity|launchTimer|bombChance|volley|time \+=|hearts/,
      );
    }
  });

  it("五款到这儿一款不漏,全都照顾了 prefers-reduced-motion", () => {
    for (const game of DOCK_B_GAMES) {
      const sources = readGameSources(game);
      const css = sources.map(inlineCss).join("\n");
      const text = sources.map((s) => s.text).join("\n");
      expect(
        respectsReducedMotion(css) || text.includes("prefers-reduced-motion"),
        `${game} 还是没照顾 prefers-reduced-motion`,
      ).toBe(true);
    }
  });
});

describe("档B R3 修复 · 复核本轮学习优化员落地的 4 条", () => {
  it("B3-L1 加压没加成断路:再深也留得住 2 颗心,守卫再快也有封顶", () => {
    for (let f = 1; f <= 400; f++) {
      const lv = buildEndlessFloor(f);
      expect(lv.hearts, `第 ${f} 层的心少于下限`).toBeGreaterThanOrEqual(RUINS_HEART_FLOOR);
      expect(ruinsPressure(f).enemySpeed, `第 ${f} 层守卫超速`).toBeLessThanOrEqual(
        RUINS_ENEMY_SPEED_MAX,
      );
      expect(levelTraversable(lv), `第 ${f} 层有跨不过去的坑`).toBe(true);
    }
    // 深层不能层层必死:抽 20 层看看还打不打得动
    let cleared = 0;
    for (let f = 70; f <= 260; f += 10) {
      if (botPlay(buildEndlessFloor(f), 240).outcome === "clear") cleared++;
    }
    expect(cleared, "第 70 层往后机器人一层都过不去").toBeGreaterThan(8);
  });

  it("B3-L2 泡泡海的冰是加压不是断路:一行最多冻两颗,而且底下是能配对的颜色", async () => {
    const { SEA_FROZEN_MAX, SEA_ROWS, pushUpRow, seaColors, seaFrozen } = await import(
      "../bubble-pop/collapse"
    );
    const { FROZEN_OFFSET, isFrozen } = await import("../bubble-pop/logic");
    const { mulberry32 } = await import("../level99");
    const rand = mulberry32(515);
    for (let n = 0; n <= 400; n++) {
      expect(seaFrozen(n)).toBeLessThanOrEqual(SEA_FROZEN_MAX);
      const empty = Array.from({ length: SEA_ROWS }, () => Array.from({ length: 8 }, () => -1));
      const fresh = pushUpRow(empty, 8, seaColors(n), rand, seaFrozen(n)).grid[SEA_ROWS - 1];
      expect(fresh.filter(isFrozen).length, `第 ${n} 推冻太多`).toBeLessThanOrEqual(SEA_FROZEN_MAX);
      expect(fresh.some((v) => !isFrozen(v)), `第 ${n} 推整行都是冰,没地方下手`).toBe(true);
      for (const v of fresh) {
        if (isFrozen(v)) expect(v - FROZEN_OFFSET).toBeLessThan(seaColors(n));
      }
    }
    // 泡泡海里绝不许出现消不掉的石头(那才是真断路)
    const sea = readGameFile("bubble-pop", "index.ts");
    const tide = sea.slice(sea.indexOf("function tide()"), sea.indexOf("function onCell", sea.indexOf("function tide()")));
    expect(tide).not.toContain("STONE");
  });

  it("B3-L3 算式摊没把夜市拧过头:节奏有地板,而且不会又黑灯又心算", async () => {
    const { QUIZ_GAP_FLOOR_MS, QUIZ_UP_FLOOR_MS, isQuizStall, stallConfig } = await import(
      "../mole-pop/levels"
    );
    for (let n = 1; n <= 400; n++) {
      if (!isQuizStall(n)) continue;
      const cfg = stallConfig(n);
      expect(cfg.upMsMin, `第 ${n} 摊快得来不及算`).toBeGreaterThanOrEqual(QUIZ_UP_FLOOR_MS);
      expect(cfg.gapMs, `第 ${n} 摊两只挨得太紧`).toBeGreaterThanOrEqual(QUIZ_GAP_FLOOR_MS);
      expect(cfg.night, `第 ${n} 摊又黑灯又要心算`).toBe(false);
      expect(cfg.maxConcurrent, `第 ${n} 摊台面上算式牌太多`).toBeLessThanOrEqual(3);
      expect(cfg.target, `第 ${n} 摊的目标分是 0`).toBeGreaterThan(0);
    }
  });

  it("B3-L4 换图没换出缺图:300 幅每一幅的图库都装得下这块板子", async () => {
    const { THEME_TILES, endlessBoard, tilesNeeded } = await import("../puzzle-tiles/levels");
    const { boardKind } = await import("../puzzle-tiles/logic");
    for (let n = 1; n <= 300; n++) {
      const cfg = endlessBoard(n);
      const need = tilesNeeded(cfg.rows, cfg.cols, boardKind(cfg));
      expect(THEME_TILES[cfg.theme], `第 ${n} 幅挑了不存在的图库`).toBeDefined();
      expect(THEME_TILES[cfg.theme].length, `第 ${n} 幅缺图`).toBeGreaterThanOrEqual(need);
    }
  });
});

describe("档B R3 修复 · 发布前总闸:五款硬约束整体再扫一遍", () => {
  it("商标黑名单 0 命中", () => {
    for (const game of DOCK_B_GAMES) {
      expect(scanTrademarks(readGameSources(game)), `${game} 撞到商标`).toEqual([]);
    }
  });

  it("没有血/死亡/骂人的字眼,失败只鼓励", () => {
    for (const game of DOCK_B_GAMES) {
      expect(scanRatingWords(readGameSources(game)), `${game} 有分级红线词`).toEqual([]);
    }
  });

  it("没有 three.js / CDN / Socket", () => {
    for (const game of DOCK_B_GAMES) {
      expect(scanExternalDeps(readGameSources(game)), `${game} 引了外部依赖`).toEqual([]);
    }
  });

  it("音效只走 api.play(...)", () => {
    for (const game of DOCK_B_GAMES) {
      expect(scanAudioMisuse(readGameSources(game)), `${game} 绕开了 api.play`).toEqual([]);
    }
  });

  it("存档 key 只增不改:本轮一个新 key 都没加", () => {
    for (const game of DOCK_B_GAMES) {
      for (const key of saveKeysIn(readGameSources(game))) {
        expect(key, `${game} 写了不认识的存档 key:${key}`).toMatch(/^(yiduo|yx)/);
      }
    }
  });

  it("每款的 mount 都还回收得干净:destroy 齐、rAF 平衡、全局监听进袋子", () => {
    for (const game of DOCK_B_GAMES) {
      const sources = readGameSources(game);
      const index = sources.find((s) => s.name === "index.ts");
      expect(index, `${game} 没有 index.ts`).toBeDefined();
      if (!index) continue;
      expect(mountFunctionsReturnDestroy(index), `${game} 有 mount 没还 destroy`).toEqual([]);
      expect(rafBalanced(index, sources), `${game} 的 rAF 没有对应的取消`).toBe(true);
    }
  });

  it("360px 上没有会撑破容器的固定宽度(每款每一份源码都扫)", () => {
    const bad: string[] = [];
    for (const game of DOCK_B_GAMES) {
      for (const source of readGameSources(game)) {
        for (const rule of overflowingRules(inlineCss(source))) bad.push(`${game}/${source.name}: ${rule.decl}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("闸门本身没扫空:五款都读到了成篇的源码", () => {
    for (const game of DOCK_B_GAMES) {
      expect(joinSources(readGameSources(game)).length, `${game} 读到的源码太短`).toBeGreaterThan(2000);
    }
  });
});
