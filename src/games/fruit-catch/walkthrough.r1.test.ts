/**
 * 接住小水果 · 窗口4 档A 第 1 轮测试员走查（不改玩法，只记录与断言）
 *
 * 剧本：首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 →
 * 双人抢果 + 无尽水果雨各玩到结算 → 360px 窄屏。
 *
 * 本轮记录到报告的问题（修复交给监督修复员）：
 *  - W4A-04：`simulateLevel` 用同一个 `basketSpeed` 既排可达性又驱动假玩家，
 *    于是「把篮子调慢」根本模拟不出输局，缺一条真输的路。
 *    本文件先用纯函数手搭一个「篮子站着不动」的小模拟顶上。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGames } from "../../engine/loader";
import { LEVELS } from "./levels";
import {
  BASKET_HALF,
  BASKET_MAX_X,
  BASKET_MIN_X,
  BASKET_SPEED,
  CATCH_Y,
  DUO_GOAL,
  FRUITS,
  H,
  MAX_MISS,
  MIN_FRUIT_D,
  RAIN_MISS_LIMIT,
  SNAP_PX,
  W,
  checkReachable,
  duoCatch,
  duoDone,
  duoInit,
  duoMiss,
  duoSide,
  duoWinner,
  duoWord,
  isCaught,
  isHazard,
  markReachable,
  missCostsLife,
  missWord,
  planDrops,
  rainCatch,
  rainInit,
  rainMiss,
  rainPlan,
  rainSpawnMs,
  rainSpeed,
  rainWord,
  simulateLevel,
  starsFor
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/**
 * 「篮子站着不动」的小模拟：只用纯函数，专门走输的那条路。
 * 生成器按正常速度排好落点，玩家一步不挪——漏够 3 颗就该收工。
 */
function simulateFrozenBasket(cfg: (typeof LEVELS)[number], seed: number): { missed: number; caught: number } {
  const startX = W / 2;
  const drops = markReachable(planDrops(cfg, seed, { count: 140, startX }), startX, BASKET_SPEED);
  let missed = 0;
  let caught = 0;
  for (const d of [...drops].sort((a, b) => a.landAt - b.landAt)) {
    const grabbed = isCaught(d.x, CATCH_Y, startX);
    if (isHazard(d.kind)) continue;
    if (grabbed) caught += FRUITS[d.kind].gain;
    else if (!d.bonus && missCostsLife(d.kind)) missed++;
    if (missed >= MAX_MISS) break;
  }
  return { missed, caught };
}

describe("接住小水果 · R1 · 从首页进入", () => {
  it("首页列得出这一款，动态加载能真的拿到 mount", async () => {
    const entry = loadGames().find((g) => g.meta.id === "fruit-catch");
    expect(entry, "首页 loadGames() 里找不到 fruit-catch").toBeTruthy();
    expect(entry!.meta.title).toBe("接住小水果");
    expect(entry!.meta.levels).toBe(LEVELS.length);
    expect(typeof (await entry!.load())).toBe("function");
  });

  it("meta.modes 声明的闯关 / 双人 / 无尽在 index.ts 里都有真入口", () => {
    const entry = loadGames().find((g) => g.meta.id === "fruit-catch");
    expect(entry!.meta.modes).toEqual(["campaign", "endless", "twoPlayer"]);
    expect(SRC).toContain("mountLevelGame(");
    expect(SRC).toContain("function mountDuo(");
    expect(SRC).toContain("function mountRain(");
    expect(SRC).toContain("recordEndlessBest(");
  });
});

describe("接住小水果 · R1 · 赢一次 + 输一次", () => {
  it("赢一次：第 1 关照着落点走就接满，零失误三星", () => {
    const r = simulateLevel(LEVELS[0], { seed: 1000 });
    expect(r.won).toBe(true);
    expect(r.caught).toBeGreaterThanOrEqual(r.target);
    expect(r.missed).toBe(0);
    expect(r.hazardHits).toBe(0);
    expect(starsFor(r.missed)).toBe(3);
  });

  it("输一次：篮子站着不动，水果会真的漏够三颗", () => {
    const out = simulateFrozenBasket(LEVELS[0], 1000);
    expect(out.missed).toBe(MAX_MISS);
  });

  it("漏水果的话只描述不批评，三句都在鼓励下一颗", () => {
    for (let n = 1; n <= 3; n++) {
      const w = missWord(n);
      expect(w.length).toBeGreaterThan(0);
      for (const bad of ["笨", "差", "太慢", "不行", "失败"]) expect(w).not.toContain(bad);
    }
    expect(missWord(3)).toContain("最后一颗爱心");
  });

  it("道具和碰不得的东西漏了不扣爱心，只有真水果才算", () => {
    expect(missCostsLife("fruit")).toBe(true);
    expect(missCostsLife("gold")).toBe(true);
    expect(missCostsLife("heavy")).toBe(true);
    for (const k of ["freeze", "magnet", "chili", "bad"] as const) expect(missCostsLife(k)).toBe(false);
  });
});

describe("接住小水果 · R1 · 战役第 1 / 100 / 188 关", () => {
  for (const lv of [0, 99, 187]) {
    it(`第 ${lv + 1} 关：条条落点赶得到，碰不得的一次都擦不着`, () => {
      const r = simulateLevel(LEVELS[lv], { seed: 1000 + lv });
      expect(r.won, `第 ${lv + 1} 关没接满：${r.caught}/${r.target}`).toBe(true);
      expect(r.hazardHits).toBe(0);
      expect(r.missed).toBe(0);
      const chk = checkReachable(markReachable(planDrops(LEVELS[lv], 1000 + lv, { count: 140 })));
      expect(chk.ok).toBe(true);
      expect(chk.hazardRisk).toBe(0);
    });
  }

  it("第 188 关比第 1 关难：目标更多、掉得更快", () => {
    expect(LEVELS[187].target).toBeGreaterThan(LEVELS[0].target);
    expect(LEVELS[187].speed).toBeGreaterThan(LEVELS[0].speed);
  });
});

describe("接住小水果 · R1 · 双人抢果玩到结算", () => {
  it("左右半屏各记各的分，先到 30 颗就收工并给出胜负", () => {
    let st = duoInit();
    for (const d of rainPlan(77, 400)) {
      if (isHazard(d.kind)) continue;
      st = duoCatch(st, duoSide(d.x), FRUITS[d.kind].gain);
      if (duoDone(st)) break;
    }
    expect(duoDone(st, DUO_GOAL)).toBe(true);
    expect(Math.max(st.doudou, st.star)).toBeGreaterThanOrEqual(DUO_GOAL);
    expect(["doudou", "star", "tie"]).toContain(duoWinner(st));
  });

  it("收场词赢的夸、输的也夸，不出现批评字眼", () => {
    for (const st of [
      { doudou: 30, star: 12, missDoudou: 0, missStar: 3 },
      { doudou: 11, star: 30, missDoudou: 4, missStar: 0 },
      { doudou: 20, star: 20, missDoudou: 1, missStar: 1 }
    ]) {
      const w = duoWord(st);
      expect(w.length).toBeGreaterThan(0);
      for (const bad of ["笨", "差", "输了", "不行"]) expect(w).not.toContain(bad);
    }
  });

  it("落点归属按半屏切：左半归朵朵，右半归星星", () => {
    expect(duoSide(1)).toBe("doudou");
    expect(duoSide(W / 2 - 1)).toBe("doudou");
    expect(duoSide(W / 2)).toBe("star");
    expect(duoSide(W - 1)).toBe("star");
  });

  it("各记各的漏球数，互不牵连", () => {
    let st = duoInit();
    st = duoMiss(st, "doudou");
    st = duoMiss(st, "doudou");
    st = duoMiss(st, "star");
    expect(st.missDoudou).toBe(2);
    expect(st.missStar).toBe(1);
  });
});

describe("接住小水果 · R1 · 无尽水果雨玩到结算", () => {
  it("漏够三颗就收工（真结算，不是玩不完）", () => {
    let st = rainInit();
    for (let i = 0; i < RAIN_MISS_LIMIT; i++) {
      expect(st.over).toBe(false);
      st = rainMiss(st, "fruit");
    }
    expect(st.over).toBe(true);
    // 收工之后再接也不动
    expect(rainCatch(st, "gold")).toEqual(st);
  });

  it("接不停就能一直下：400 颗的出场表条条可达，全接完也没被叫停", () => {
    const plan = rainPlan(2024, 400);
    expect(checkReachable(markReachable([...plan])).ok).toBe(true);
    let st = rainInit();
    for (const d of plan) st = isHazard(d.kind) ? st : rainCatch(st, d.kind);
    expect(st.over).toBe(false);
    expect(st.score).toBeGreaterThan(0);
    expect(st.bestCombo).toBeGreaterThan(20);
    expect(plan[plan.length - 1].landAt).toBeGreaterThan(180);
  });

  it("接到辣椒 / 捣蛋物断连击又少一次机会，但话还是鼓励的", () => {
    let st = rainCatch(rainCatch(rainInit(), "fruit"), "fruit");
    expect(st.combo).toBe(2);
    st = rainCatch(st, "chili");
    expect(st.combo).toBe(0);
    expect(st.missed).toBe(1);
    const w = rainWord(st, 9999);
    for (const bad of ["笨", "差", "输了", "不行"]) expect(w).not.toContain(bad);
  });

  it("越往后越密、越快，但都有下限 / 上限", () => {
    expect(rainSpawnMs(0)).toBeGreaterThan(rainSpawnMs(50));
    expect(rainSpawnMs(100000)).toBe(420);
    expect(rainSpeed(0)).toBeLessThan(rainSpeed(50));
    expect(rainSpeed(100000)).toBe(2.1);
  });
});

describe("接住小水果 · R1 · 360px 窄屏", () => {
  it("场地就是 360×460，篮子跑不出左右边界", () => {
    expect(W).toBe(360);
    expect(H).toBe(460);
    expect(BASKET_MIN_X).toBeGreaterThan(0);
    expect(BASKET_MAX_X).toBeLessThan(W);
    expect(BASKET_MAX_X - BASKET_MIN_X).toBeGreaterThan(BASKET_HALF * 2);
  });

  it("水果直径不小于 32px，360px 上看得清也抓得住", () => {
    expect(MIN_FRUIT_D).toBeGreaterThanOrEqual(32);
    expect(BASKET_HALF * 2 + SNAP_PX * 2).toBeLessThan(W / 2);
  });

  it("所有落点都落在篮子够得着的区间里，没有贴边贴到抓不着", () => {
    for (const lv of [0, 99, 187]) {
      for (const d of planDrops(LEVELS[lv], 4242 + lv, { count: 80 })) {
        expect(d.x).toBeGreaterThanOrEqual(BASKET_MIN_X - 1e-6);
        expect(d.x).toBeLessThanOrEqual(BASKET_MAX_X + 1e-6);
      }
    }
  });
});

describe("接住小水果 · R1 · 分级红线", () => {
  it("音效只走平台的 api.play，没有自己造 AudioContext", () => {
    expect(SRC).not.toContain("AudioContext");
    expect(SRC).not.toContain("new Audio");
  });

  it("没有引入 three.js / CDN / Socket，也没有联网请求", () => {
    for (const bad of ["three", "socket", "fetch(", "XMLHttpRequest", "http://", "https://"]) {
      expect(SRC.toLowerCase()).not.toContain(bad.toLowerCase());
    }
  });
});
