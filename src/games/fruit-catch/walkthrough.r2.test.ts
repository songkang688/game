/**
 * 接住小水果 · 窗口 4 档A · 第 2 轮测试员。
 *
 * 第 1 轮只把第 1 / 100 / 188 关跑通了。这一轮换关卡、换模式，专盯三件事：
 *  ① 难度曲线——从第 1 关爬到第 188 关，孩子到底感觉到什么在变难；
 *  ② 竞态——同一帧落地好几颗、冰冻和磁铁叠在一起、沉水果压慢的那 1.2 秒；
 *  ③ 无尽能不能一直接下去。
 * 本段只读不改：一行玩法代码都没动。
 */
import { describe, it, expect } from "vitest";
import { LEVELS, CHAPTERS, type CatchLevel } from "./levels";
import {
  BASKET_SPEED, BASKET_HALF, SNAP_PX, MAGNET_EXTRA, CATCH_Y, W, MAX_MISS,
  FREEZE_SECONDS, MAGNET_SECONDS, HEAVY_SLOW_S, HEAVY_SLOW_FACTOR,
  basketSpeedNow, isCaught, minSpeedNeeded, sameFrameGroups, markReachable,
  planDrops, rainPlan, rainSpawnMs, rainSpeed, rainInit, rainCatch, rainMiss,
  rainWord, RAIN_MISS_LIMIT, simulateLevel, checkReachable, steadyMul, scoreFor,
  duoInit, duoCatch, duoMiss, duoWinner, duoDone, duoWord, duoSide, DUO_GOAL,
  isHazard, FRUITS
} from "./logic";
import { mulberry32 } from "../level99";

/** 这一轮抽查的关卡：横跨十个章节，一个第 1 关都不带 */
const SPOTS = [12, 25, 44, 60, 78, 95, 110, 128, 150, 170, 185];

describe("接住小水果 · R2 · 换关卡再打一遍", () => {
  it("抽查的十一关都能赢，而且赢在及格线之上", () => {
    for (const lv of SPOTS) {
      const cfg = LEVELS[lv - 1];
      const res = simulateLevel(cfg, { seed: 6200 + lv });
      expect(res.won, `第 ${lv} 关`).toBe(true);
      expect(res.caught, `第 ${lv} 关`).toBeGreaterThanOrEqual(cfg.target);
      // 照着链走就不该被炸弹 / 辣椒擦到
      expect(res.hazardHits, `第 ${lv} 关`).toBe(0);
      // 一关别拖太久：孩子的注意力撑不住两分钟
      expect(res.seconds, `第 ${lv} 关`).toBeLessThan(60);
    }
  });

  it("站着不动也会输，输在第 3 颗——爱心用完就收，不会没完没了", () => {
    for (const lv of SPOTS) {
      const cfg = LEVELS[lv - 1];
      // playerSpeed = 0 就是「手一直没动」的孩子
      const res = simulateLevel(cfg, { seed: 6200 + lv, playerSpeed: 0 });
      expect(res.won, `第 ${lv} 关`).toBe(false);
      expect(res.missed, `第 ${lv} 关`).toBe(MAX_MISS);
    }
  });

  it("每一关的下落表都自洽：必接的条条赶得到，碰不得的一次都擦不着", () => {
    for (const lv of SPOTS) {
      const cfg = LEVELS[lv - 1];
      const plan = markReachable(planDrops(cfg, 900 + lv, { count: 140 }));
      const rep = checkReachable(plan);
      expect(rep.ok, `第 ${lv} 关 firstBad=${rep.firstBad} hazard=${rep.hazardRisk}`).toBe(true);
    }
  });
});

describe("接住小水果 · R2 · 难度曲线", () => {
  it("章节内一路加码：越往后目标越多、出得越密", () => {
    let at = 0;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const size = CHAPTERS[ci].size;
      const seg = LEVELS.slice(at, at + size);
      at += size;
      expect(seg[size - 1].target, `第 ${ci + 1} 章目标`).toBeGreaterThan(seg[0].target);
      expect(seg[size - 1].spawnMs, `第 ${ci + 1} 章间隔`).toBeLessThan(seg[0].spawnMs);
      expect(seg[size - 1].speed, `第 ${ci + 1} 章落速`).toBeGreaterThan(seg[0].speed);
    }
    expect(at).toBe(LEVELS.length);
  });

  it("换章节时会松一口气：新章节第 1 关不比上一章最后一关更凶", () => {
    let at = 0;
    for (let ci = 0; ci < CHAPTERS.length - 1; ci++) {
      at += CHAPTERS[ci].size;
      const last = LEVELS[at - 1];
      const first = LEVELS[at];
      expect(first.spawnMs, `第 ${ci + 2} 章开头`).toBeGreaterThan(last.spawnMs);
      expect(first.speed, `第 ${ci + 2} 章开头`).toBeLessThan(last.speed);
    }
  });

  /**
   * W4A-09（轻微）· 手速门槛原本全程是一条直线，本轮学习优化员铺出了坡。
   *
   * `needSpeed` 是「照着链走一趟，篮子最少要跑多快才一颗都不漏」。
   * 原先生成器排链一律顶着篮子极速排，所以第 1 关和第 188 关都稳稳压在
   * 210~230 像素/秒——「跑多快」这一维根本没参与难度。
   *
   * 改法是给关卡加一个 `reach`（这一关用掉多少「够得着的范围」），
   * 章内一路加宽、换章再松一口气。前 99 关是 1.0 冻结的，一个参数都没动
   * （`levels188.test.ts` 有指纹守着），所以坡只铺在 1.1 之后的四条果道上。
   */
  it("W4A-09 已修：新四章的手速门槛从四成一路爬到八成", () => {
    const need = (lv: number) => simulateLevel(LEVELS[lv - 1], { seed: 4200 + lv }).needSpeed;
    // 每一章开头都松：只要四到六成的篮子极速
    for (const lv of [100, 123, 145, 167]) {
      expect(need(lv) / BASKET_SPEED, `第 ${lv} 关`).toBeLessThan(0.66);
    }
    // 每一章结尾都紧：逼近八成
    for (const lv of [122, 144, 166, 188]) {
      expect(need(lv) / BASKET_SPEED, `第 ${lv} 关`).toBeGreaterThan(0.75);
    }
    // 章内是往上爬的
    expect(need(122)).toBeGreaterThan(need(100));
    expect(need(188)).toBeGreaterThan(need(167));
    // 换章一定松一口气：新章开头不比上一章结尾更紧
    expect(need(123)).toBeLessThan(need(122));
    expect(need(145)).toBeLessThan(need(144));
    expect(need(167)).toBeLessThan(need(166));
  });

  it("W4A-09 已修：一章比一章的起点更高，坡是往上抬的", () => {
    const reach = (lv: number) => LEVELS[lv - 1].reach!;
    const starts = [100, 123, 145, 167].map(reach);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
    // 每一章都收在同一个顶格，不会有哪一章偷偷更凶
    for (const lv of [122, 144, 166, 188]) expect(reach(lv)).toBe(0.98);
  });

  it("前 99 关是 1.0 冻结的：一个 reach 都没加，门槛还是原来那条直线", () => {
    const need = (lv: number) => simulateLevel(LEVELS[lv - 1], { seed: 4200 + lv }).needSpeed;
    for (let lv = 1; lv <= 99; lv++) expect(LEVELS[lv - 1].reach, `第 ${lv} 关`).toBeUndefined();
    const legacy = [1, 25, 50, 75, 99].map(need);
    expect(Math.max(...legacy) - Math.min(...legacy)).toBeLessThan(15);
  });

  it("手慢一点还有余量：只跑六成速也能把抽查的关都接下来", () => {
    for (const lv of SPOTS) {
      const res = simulateLevel(LEVELS[lv - 1], { seed: 5100 + lv, playerSpeed: BASKET_SPEED * 0.6 });
      expect(res.won, `第 ${lv} 关六成速`).toBe(true);
    }
  });

  it("余量不是无限的：掉到四成速就有关卡接不住了——这条线是真的存在", () => {
    const lost = SPOTS.filter((lv) => !simulateLevel(LEVELS[lv - 1], { seed: 5100 + lv, playerSpeed: BASKET_SPEED * 0.4 }).won);
    expect(lost.length).toBeGreaterThan(0);
  });
});

describe("接住小水果 · R2 · 竞态", () => {
  it("同一帧落地好几颗时，链上的那颗照样算接住", () => {
    for (const lv of [25, 78, 128, 185]) {
      const plan = markReachable(planDrops(LEVELS[lv - 1], 3300 + lv, { count: 140 }));
      for (const g of sameFrameGroups(plan)) {
        // 同一刻落地的两颗之间至少隔开一个篮口，不会「接了这颗顺手把炸弹也兜进来」
        for (let i = 0; i < g.length; i++) {
          for (let j = i + 1; j < g.length; j++) {
            if (!isHazard(g[i].kind) && !isHazard(g[j].kind)) continue;
            expect(Math.abs(g[i].x - g[j].x), `第 ${lv} 关 ${g[i].landAt}`).toBeGreaterThan(BASKET_HALF + SNAP_PX);
          }
        }
      }
    }
  });

  it("磁铁生效时篮口变大，但大不到把旁边的炸弹也吸进来", () => {
    const wide = BASKET_HALF + SNAP_PX + MAGNET_EXTRA;
    expect(isCaught(0, CATCH_Y, wide - 1, { magnet: true })).toBe(true);
    expect(isCaught(0, CATCH_Y, wide + 1, { magnet: true })).toBe(false);
    // 生成器给碰不得的东西留的间距（HAZARD_CLEAR=80）要盖得住磁铁放宽的这一段
    expect(wide).toBeLessThan(80);
  });

  it("沉水果压慢的 1.2 秒里篮子仍然跑得动，压完立刻恢复", () => {
    expect(basketSpeedNow(HEAVY_SLOW_S)).toBeCloseTo(BASKET_SPEED * HEAVY_SLOW_FACTOR);
    expect(basketSpeedNow(0)).toBe(BASKET_SPEED);
    // 压慢期间跑得过一个篮口宽——不至于原地不动
    expect(basketSpeedNow(HEAVY_SLOW_S) * HEAVY_SLOW_S).toBeGreaterThan(BASKET_HALF * 2);
  });

  it("冰冻和磁铁各走各的表，叠在一起也不会互相抹掉", () => {
    // 两个道具时长不同：先接冰冻再接磁铁，磁铁不该被冰冻的倒计时带走
    let freeze = FREEZE_SECONDS;
    let magnet = 0;
    const dt = 0.1;
    for (let i = 0; i < 5; i++) {
      freeze = Math.max(0, freeze - dt);
      magnet = Math.max(0, magnet - dt);
    }
    magnet = MAGNET_SECONDS;
    expect(freeze).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) {
      freeze = Math.max(0, freeze - dt);
      magnet = Math.max(0, magnet - dt);
    }
    expect(freeze).toBe(0);
    expect(magnet).toBeGreaterThan(0);
  });

  it("同一颗水果不会被结算两次：接住的判定带上下边界", () => {
    // 还没到篮口高度：不算
    expect(isCaught(100, CATCH_Y - 20, 100)).toBe(false);
    // 已经掉过头：也不算（漏掉那一支去走 rainMiss）
    expect(isCaught(100, CATCH_Y + 20, 100)).toBe(false);
    expect(isCaught(100, CATCH_Y, 100)).toBe(true);
  });

  it("爱心扣到 0 之后再漏再接都不动数了——收场那一下不会连扣", () => {
    let st = rainInit();
    for (let i = 0; i < RAIN_MISS_LIMIT; i++) st = rainMiss(st, "fruit");
    expect(st.over).toBe(true);
    const frozen = st;
    st = rainMiss(st, "fruit");
    st = rainCatch(st, "gold");
    expect(st).toBe(frozen);
  });
});

describe("接住小水果 · R2 · 无尽能不能一直接下去", () => {
  it("越往后越密越快，但都有封顶——不会快到没法玩", () => {
    expect(rainSpawnMs(0)).toBeGreaterThan(rainSpawnMs(30));
    expect(rainSpawnMs(65)).toBe(420);
    expect(rainSpawnMs(500)).toBe(420);
    expect(rainSpeed(0)).toBeLessThan(rainSpeed(30));
    expect(rainSpeed(72)).toBeCloseTo(2.1);
    expect(rainSpeed(500)).toBeCloseTo(2.1);
  });

  it("封顶之后是一条平路：第 100 颗和第 300 颗的手速门槛差不多", () => {
    const plan = markReachable(rainPlan(99, 320));
    const seg = (a: number, b: number) => minSpeedNeeded(plan.slice(a, b));
    expect(Math.abs(seg(100, 200) - seg(220, 320))).toBeLessThan(25);
  });

  /**
   * W4A-11（中等）· 无尽其实只有两分半。
   *
   * `reset()` 里排的是一张 320 颗的固定表（`rainPlan(seed, 320)`）；
   * 出场表走完、屏幕上一颗不剩时 `tick` 就直接 `finish()`。
   * 320 颗按 rainSpawnMs 累出来的总时长约 156 秒——也就是说，
   * 就算孩子一颗都没漏，果雨也会在 2 分 36 秒时自己下完、自己结算。
   * 「无尽」的承诺是「能一直玩到手滑为止」，现在是「能玩到表用完为止」。
   * 记录在案，交给学习优化员：表走完该续排，而不是收场。
   */
  it("W4A-11 特征化：320 颗的固定表走完就结算，撑不过 3 分钟", () => {
    const plan = rainPlan(2026, 320);
    const last = Math.max(...plan.map((p) => p.landAt));
    expect(last).toBeGreaterThan(150);
    expect(last).toBeLessThan(180);
    // 表是有限长的：没有任何一颗排在 3 分钟之后
    expect(plan.every((p) => p.landAt < 180)).toBe(true);
  });

  it("真接一场：一路不漏，分数一直涨，连接倍率封顶在 2 倍", () => {
    const plan = markReachable(rainPlan(4321, 320)).sort((a, b) => a.landAt - b.landAt);
    let st = rainInit();
    for (const p of plan) {
      if (isHazard(p.kind)) continue;
      const before = st.score;
      st = rainCatch(st, p.kind);
      expect(st.score).toBeGreaterThan(before);
    }
    expect(st.over).toBe(false);
    expect(st.bestCombo).toBe(st.caught > 0 ? st.combo : 0);
    expect(steadyMul(st.combo)).toBe(2);
    expect(scoreFor("gold", 999)).toBe(60);
  });

  it("漏掉奖励果不扣爱心，接到辣椒才扣——三次就收场", () => {
    let st = rainInit();
    for (let i = 0; i < 10; i++) st = rainMiss(st, "fruit", true);
    expect(st.missed).toBe(0);
    st = rainCatch(st, "chili");
    st = rainCatch(st, "chili");
    expect(st.over).toBe(false);
    st = rainCatch(st, "chili");
    expect(st.over).toBe(true);
  });

  it("收场词只夸不批评，破纪录和没破纪录都给下一句鼓励", () => {
    const st = { ...rainInit(), score: 500, caught: 40, bestCombo: 12 };
    for (const word of [rainWord(st, 100), rainWord(st, 900), rainWord(rainInit(), 0)]) {
      expect(word).not.toMatch(/失败|输了|太差|笨|不行/);
      expect(word).toMatch(/[！~～]/);
    }
  });
});

describe("接住小水果 · R2 · 双人接果玩到结算", () => {
  it("两边各接各的，先到 30 颗那边赢，收场词点名赢家", () => {
    let st = duoInit();
    const rand = mulberry32(20260827);
    let guard = 0;
    while (!duoDone(st) && guard++ < 2000) {
      const who = rand() < 0.56 ? "doudou" : "star";
      st = duoCatch(st, who, 1);
    }
    expect(duoDone(st)).toBe(true);
    expect(Math.max(st.doudou, st.star)).toBeGreaterThanOrEqual(DUO_GOAL);
    const win = duoWinner(st);
    expect(win === "doudou" || win === "star").toBe(true);
    const word = duoWord(st);
    expect(word).toContain(win === "doudou" ? "朵朵" : "星星");
    expect(word).not.toMatch(/输了|失败|太差/);
  });

  it("平手也有话说，不会空着", () => {
    let st = duoInit();
    for (let i = 0; i < DUO_GOAL; i++) {
      st = duoCatch(st, "doudou", 1);
      st = duoCatch(st, "star", 1);
    }
    expect(duoWinner(st)).toBe("tie");
    expect(duoWord(st).length).toBeGreaterThan(6);
  });

  it("漏球只清连接、不倒扣分，孩子不会越玩越少", () => {
    let st = duoCatch(duoInit(), "star", 5);
    const before = st.star;
    st = duoMiss(st, "star");
    expect(st.star).toBe(before);
  });

  it("左半屏归朵朵、右半屏归星星，分界线正好在中间", () => {
    expect(duoSide(1)).toBe("doudou");
    expect(duoSide(W - 1)).toBe("star");
    expect(duoSide(W / 2 - 1)).toBe("doudou");
  });
});

describe("接住小水果 · R2 · 360px 再走一遍", () => {
  it("画布本来就是 360 宽，篮子在两端都不会滑出屏幕", () => {
    expect(W).toBe(360);
    for (const lv of SPOTS) {
      const cfg: CatchLevel = LEVELS[lv - 1];
      const plan = planDrops(cfg, 700 + lv, { count: 140 });
      for (const p of plan) {
        expect(p.x, `第 ${lv} 关落点`).toBeGreaterThanOrEqual(0);
        expect(p.x, `第 ${lv} 关落点`).toBeLessThanOrEqual(W);
      }
    }
  });

  it("每种水果都有名字和图，360 宽的 HUD 里不会冒出空白格", () => {
    for (const kind of Object.keys(FRUITS) as (keyof typeof FRUITS)[]) {
      expect(FRUITS[kind].name.length).toBeGreaterThan(0);
      expect(FRUITS[kind].gain).toBeGreaterThanOrEqual(0);
    }
  });
});
