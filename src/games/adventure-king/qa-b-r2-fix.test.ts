/**
 * 窗口4 · 档B · 第 2 轮监督修复员 —— 本轮改动的复核闸门。
 *
 * 第 2 轮没有阻断 / 严重问题，测试员登记的 B2-01 ~ B2-04 都由学习优化员当轮清掉了，
 * B2-05 给出了驳回结论。所以本轮修复员的活是**复核**，分三件：
 *
 * 1. 红线总闸照跑一遍（`qa-b-r1-fix.test.ts` 那 12 条），本文件不重复；
 * 2. 本轮新写的加压代码有没有把哪条硬约束蹭掉——尤其是「越加越难」会不会
 *    加出一个点不过来 / 看不清 / 排不出的局面；
 * 3. 五款的 `destroy` 在改过运行时之后仍旧收得干净（泡泡海的 `tide()` 现在会连推两行，
 *    古堡的种子从「每间一摇」改成了「一趟一个」）。
 */
import { describe, expect, it } from "vitest";
import { Disposer, buildCastleRoom, solveRoom } from "./explore";
import {
  DOCK_B_GAMES,
  joinSources,
  readGameSources,
  saveKeysIn,
  scanAudioMisuse,
  scanExternalDeps,
  scanRatingWords,
  scanTrademarks,
  type DockBGame,
  type GameSource,
} from "./qaAudit";
import {
  SEA_PUSH_FLOOR_MS,
  SEA_ROWS,
  BubbleBag,
  seaColors,
  seaPushMs,
  seaTideRows,
  type BubbleBagHost,
} from "../bubble-pop/collapse";
import { BOARD_COLS } from "../bubble-pop/levels";
import { STORM_COUNT_MAX, stormPace, stormWave } from "../fruit-slice/blade";
import { ENDLESS_CONCURRENT_MAX, endlessWave } from "../mole-pop/levels";
import { chartMaxPoints, maxConcurrentOf, nightMarketChart } from "../mole-pop/rhythm";
import { GALLERY_HINT_FLOOR, endlessBoard } from "../puzzle-tiles/levels";
import { boardKind } from "../puzzle-tiles/logic";

const ALL: Array<[DockBGame, GameSource[]]> = DOCK_B_GAMES.map((g) => [g, readGameSources(g)]);

/** 地鼠台面一共 9 个洞（`mole-pop/index.ts` 的 `Array.from({ length: 9 })`） */
const HOLES = 9;

/**
 * 本档五款到第 2 轮为止用过的全部存档 key。
 * 与第 1 轮那份名单逐字相同——本轮改的全是关卡与无尽曲线的生成函数，一个 key 都没动。
 */
const SAVE_KEYS_R2 = [
  "yiduo-yixing.adventure-king.album.v1",
  "yiduo-yixing.adventure-king.speedrun.v1",
  "yiduo-yixing.fruit-slice.best.v1",
  "yiduo-yixing.fruit-slice.campaign.v2",
  "yiduo-yixing.puzzle-tiles.preview.v1",
  "yiduo-yixing.puzzle-tiles.resume.v1",
];

describe("档B R2 修复 · 红线复核(改了运行时之后再扫一遍)", () => {
  it("商标 / 分级 / 外部依赖 / 音效:五款合计仍旧 0 命中", () => {
    const hits: string[] = [];
    for (const [game, sources] of ALL) {
      for (const h of scanTrademarks(sources)) hits.push(`${game} 商标: ${h}`);
      for (const h of scanRatingWords(sources)) hits.push(`${game} 分级: ${h}`);
      for (const h of scanExternalDeps(sources)) hits.push(`${game} 外部依赖: ${h}`);
      for (const h of scanAudioMisuse(sources)) hits.push(`${game} 音效: ${h}`);
    }
    expect(hits).toEqual([]);
  });

  it("存档 key 只增不改:第 2 轮一个都没动", () => {
    const keys = new Set<string>();
    for (const [, sources] of ALL) for (const k of saveKeysIn(sources)) keys.add(k);
    expect([...keys].sort()).toEqual(SAVE_KEYS_R2);
  });

  it("本轮新写的常数与注释里没有夹带红线词", () => {
    // 加压代码写了不少「拧到底 / 封顶 / 劝退」这类话，专门再扫一遍改动最多的那几份
    const touched = [
      ["bubble-pop", "collapse.ts"],
      ["fruit-slice", "blade.ts"],
      ["mole-pop", "levels.ts"],
      ["puzzle-tiles", "levels.ts"],
      ["adventure-king", "explore.ts"],
    ] as const;
    for (const [game, file] of touched) {
      const src = readGameSources(game).filter((s) => s.name === file);
      expect(src.length, `${game}/${file} 没读到`).toBe(1);
      expect(scanRatingWords(src), `${game}/${file} 有分级红线词`).toEqual([]);
      expect(scanTrademarks(src), `${game}/${file} 有商标`).toEqual([]);
    }
  });

  it("没有为了加压而偷偷加发声点:五款仍旧只走 api.play(...)", () => {
    for (const [game, sources] of ALL) {
      const text = joinSources(sources);
      expect(text.includes("new Audio("), `${game} 自己 new 了 Audio`).toBe(false);
      expect(text.includes("AudioContext"), `${game} 自己开了 AudioContext`).toBe(false);
    }
  });
});

describe("档B R2 修复 · 加压加得动,但没加过头", () => {
  it("地鼠夜市:台面预算涨到 5 只也塞得进 9 个洞,而且还留着一半空洞", () => {
    // 台面确实是 9 个洞——钉住它，免得哪天洞数改了这条用例还在拿旧数比
    const moleIndex = readGameSources("mole-pop").find((s) => s.name === "index.ts")!;
    expect(moleIndex.text, "地鼠台面不再是 9 个洞了").toContain("Array.from({ length: 9 }");
    expect(ENDLESS_CONCURRENT_MAX).toBeLessThan(HOLES);
    for (const wave of [1, 25, 40, 60, 120, 400]) {
      const cfg = endlessWave(wave);
      const chart = nightMarketChart(cfg, wave, wave * 977 + 13);
      expect(maxConcurrentOf(chart), `第 ${wave} 摊排爆了台面`).toBeLessThanOrEqual(cfg.maxConcurrent);
      expect(cfg.maxConcurrent, `第 ${wave} 摊把洞占满了`).toBeLessThanOrEqual(HOLES - 4);
    }
  });

  it("地鼠夜市:再难也够得着目标分,而且反应时间不低于 240ms", () => {
    for (let wave = 1; wave <= 400; wave += 7) {
      const cfg = endlessWave(wave);
      expect(cfg.gapMs, `第 ${wave} 摊出洞间隔紧到人反应不过来`).toBeGreaterThanOrEqual(240);
      expect(cfg.upMsMin, `第 ${wave} 摊地鼠露头就缩`).toBeGreaterThanOrEqual(340);
      const chart = nightMarketChart(cfg, wave, wave * 31 + 7);
      expect(chartMaxPoints(chart), `第 ${wave} 摊全打中也够不着目标分`).toBeGreaterThanOrEqual(cfg.target);
    }
  });

  it("泡泡海:再快也留 1.8 秒,大潮也不会把一屏一次顶穿", () => {
    for (let n = 0; n <= 400; n++) {
      expect(seaPushMs(n), `第 ${n} 推快过下限`).toBeGreaterThanOrEqual(SEA_PUSH_FLOOR_MS);
      expect(seaTideRows(n), `第 ${n} 推一次涨太多行`).toBeLessThanOrEqual(2);
      expect(seaColors(n), `第 ${n} 推的颜色多到分不清`).toBeLessThanOrEqual(5);
    }
    // 一次最多涨 2 行,离 12 行的一屏差得远,不会出现「一潮直接收摊」
    expect(Math.max(...Array.from({ length: 400 }, (_, i) => seaTideRows(i)))).toBeLessThan(SEA_ROWS);
    expect(BOARD_COLS).toBeGreaterThan(0);
  });

  it("水果暴风:抛数封在 9 颗,间隔与炸弹率没跟着一起加", () => {
    for (let i = 0; i <= 400; i++) {
      const p = stormPace(i);
      expect(p.count, `第 ${i} 波抛过头`).toBeLessThanOrEqual(STORM_COUNT_MAX);
      expect(p.interval, `第 ${i} 波快过下限`).toBeGreaterThanOrEqual(0.55);
      expect(p.bombChance, `第 ${i} 波炸弹多过上限`).toBeLessThanOrEqual(0.34);
      // 一波里同时混三种新目标已经是上限,不会再多
      expect(stormWave(i, 4242).extras.length).toBeLessThanOrEqual(3);
    }
  });

  it("无尽画廊:板子没被加压撑破 6×6,提示也没扣光", () => {
    for (let round = 1; round <= 400; round++) {
      const b = endlessBoard(round);
      expect(b.rows, `第 ${round} 幅超过 6×6,360px 上点不准`).toBeLessThanOrEqual(6);
      expect(b.cols).toBe(b.rows);
      expect(b.hints, `第 ${round} 幅的提示被扣光`).toBeGreaterThanOrEqual(GALLERY_HINT_FLOOR);
      expect(b.moveLimit, `第 ${round} 幅步数收紧到连二星线都够不着`).toBeGreaterThan(b.two);
      if (boardKind(b) === "slide") {
        expect(b.timeLimit ?? 999, `第 ${round} 幅的限时压过头`).toBeGreaterThanOrEqual(120);
      }
    }
  });

  it("无尽古堡:改了发牌之后每一间照样走得通", () => {
    for (let room = 1; room <= 120; room++) {
      const built = buildCastleRoom(20260827, room);
      expect(solveRoom(built.state), `第 ${room} 间走不通`).toBe(true);
    }
  });
});

describe("档B R2 修复 · destroy 仍旧收得干净", () => {
  /** 数得清「还剩几件没收」的假宿主 */
  function fakeHost(): { host: BubbleBagHost; live: () => number } {
    const timers = new Set<number>();
    const rafs = new Set<number>();
    let next = 1;
    return {
      host: {
        setTimeout: (_fn, _ms) => {
          const id = next++;
          timers.add(id);
          return id;
        },
        clearTimeout: (id) => void timers.delete(id),
        cancelRaf: (id) => void rafs.delete(id),
      },
      live: () => timers.size + rafs.size,
    };
  }

  it("泡泡海连推两行也不会绕过口袋:收摊后一件活都排不进去", () => {
    const { host, live } = fakeHost();
    const bag = new BubbleBag(host);
    for (let i = 0; i < 20; i++) bag.after(() => undefined, 100);
    bag.close();
    expect(bag.alive).toBe(false);
    expect(live(), "收摊之后还留着活口").toBe(0);
    // 收摊之后再排一件,当场就地收掉
    bag.after(() => expect.unreachable("收摊后的活儿不该跑起来"), 10);
    expect(live()).toBe(0);
  });

  it("连开连关 20 轮:泡泡海的口袋一个活口都不剩", () => {
    const { host, live } = fakeHost();
    for (let round = 0; round < 20; round++) {
      const bag = new BubbleBag(host);
      for (let i = 0; i < 5; i++) bag.after(() => undefined, 50 + i);
      bag.close();
    }
    expect(live()).toBe(0);
  });

  it("古堡改成「一趟一个种子」之后,Disposer 照样一把收干净", () => {
    const bag = new Disposer();
    const collected: number[] = [];
    for (let i = 0; i < 10; i++) bag.add(() => collected.push(i));
    bag.dispose();
    expect(collected).toHaveLength(10);
    // 再收一次不会把同一件事收两遍
    bag.dispose();
    expect(collected).toHaveLength(10);
  });
});
