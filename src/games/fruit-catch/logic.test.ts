// 1.2 第 20 步 A 档：接住小水果的可达性生成 / 吸附 / 计分 / 双人 / 无尽水果雨
import { describe, expect, it } from "vitest";
import {
  BASKET_HALF,
  BASKET_MAX_X,
  BASKET_MIN_X,
  BASKET_SPEED,
  CATCH_Y,
  DUO_GOAL,
  FREEZE_SECONDS,
  FRUITS,
  HAZARD_CLEAR,
  Janitor,
  MAGNET_EXTRA,
  MAGNET_SECONDS,
  MAX_MISS,
  MIN_FRUIT_D,
  PLAYERS,
  RAIN_MISS_LIMIT,
  SNAP_PX,
  SPEC_KINDS,
  STEADY_MAX,
  TWIN_GAP,
  W,
  basketSpeedNow,
  beltSpawnX,
  beltX,
  checkReachable,
  clampBasket,
  duoCatch,
  duoDone,
  duoInit,
  duoMiss,
  duoSide,
  duoWinner,
  duoWord,
  fallSeconds,
  hazardX,
  isCaught,
  isHazard,
  markReachable,
  missCostsLife,
  missWord,
  pickKind,
  planDrops,
  predictBasket,
  rainCatch,
  rainInit,
  rainMiss,
  rainPlan,
  rainSpawnMs,
  rainSpeed,
  rainWord,
  reachSpan,
  sameFrameGroups,
  scoreFor,
  simulateLevel,
  starsFor,
  steadyMul,
  windOffset,
  type DropPlan,
  type FruitKind,
  type TimerHost
} from "./logic";
import { LEVELS } from "./levels";

function drop(landAt: number, x: number, kind: FruitKind = "fruit", bonus = false): DropPlan {
  const vy = 200;
  return { at: Math.max(0, landAt - (CATCH_Y + 20) / vy), x, vy, kind, landAt, bonus };
}

// ---------------------------------------------------------------------------
// 一、可达性生成：1.1「两端同时落必掉一颗」正面解决
// ---------------------------------------------------------------------------

describe("接住小水果 · 可达性生成", () => {
  it("随机 2000 次生成，条条都赶得到，也一次都不会被逼着去撞捣蛋物", () => {
    let bonusSeen = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const cfg = LEVELS[seed % LEVELS.length];
      const plan = planDrops(cfg, seed, { count: 18 });
      const report = checkReachable(plan);
      if (!report.ok) {
        throw new Error(`第 ${seed} 次生成不可达：firstBad=${report.firstBad} hazardRisk=${report.hazardRisk}`);
      }
      bonusSeen += report.bonusCount;
    }
    // 2000 次里总得摇出几对「同时落地」，不然奖励果这条路等于没走过
    expect(bonusSeen).toBeGreaterThan(0);
  });

  it("相邻两颗的落点差，永远在「篮子速度 × 时间差」之内，还留着 15% 余量", () => {
    const plan = planDrops(LEVELS[0], 7, { count: 40 })
      .filter((d) => !d.bonus && !isHazard(d.kind))
      .sort((a, b) => a.landAt - b.landAt);
    let x = W / 2;
    let t = 0;
    for (const d of plan) {
      const need = Math.abs(d.x - x) / BASKET_SPEED;
      expect(need).toBeLessThanOrEqual((d.landAt - t) * (1 - 0.15) + 1e-6);
      x = d.x;
      t = d.landAt;
    }
  });

  it("同一刻落地的一组里，永远只有第一颗算必接，其余都是漏了不扣爱心的奖励果", () => {
    const plan = planDrops(LEVELS[150], 99, { count: 120, twinChance: 1 });
    const groups = sameFrameGroups(plan);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.filter((d) => !d.bonus).length).toBe(1);
      for (const d of g) if (d.bonus) expect(missCostsLife(d.kind) && !d.bonus).toBe(false);
    }
  });

  it("同时落地的两颗故意摆得很远，明摆着二选一而不是「看运气」", () => {
    const plan = planDrops(LEVELS[120], 5, { count: 60, twinChance: 1 });
    for (const g of sameFrameGroups(plan)) {
      const main = g.find((d) => !d.bonus)!;
      for (const other of g) {
        if (other === main) continue;
        expect(Math.abs(other.x - main.x)).toBeGreaterThanOrEqual(TWIN_GAP - 1e-6);
      }
    }
  });

  it("1.1 那种「上一颗最左、下一颗立刻最右」的组合，会被标成奖励果而不是硬扣爱心", () => {
    const cruel = [drop(1, BASKET_MIN_X), drop(1.2, BASKET_MAX_X)];
    markReachable(cruel);
    expect(cruel[0].bonus).toBe(false);
    expect(cruel[1].bonus).toBe(true);
    expect(checkReachable(cruel).ok).toBe(true);
  });

  it("捣蛋物与小辣椒不进「必接链」，只躲在预测篮位 80px 以外", () => {
    const plan = planDrops(LEVELS[187], 4242, { count: 80 });
    const chain = plan
      .filter((d) => !isHazard(d.kind) && !d.bonus)
      .sort((a, b) => a.landAt - b.landAt)
      .map((d) => ({ landAt: d.landAt, x: d.x }));
    const hazards = plan.filter((d) => isHazard(d.kind));
    expect(hazards.length).toBeGreaterThan(0);
    for (const h of hazards) {
      const p = predictBasket(chain, h.landAt);
      // 边角实在挤不开时至少也要远过篮口 + 吸附
      expect(Math.abs(h.x - p)).toBeGreaterThan(BASKET_HALF + SNAP_PX);
    }
  });

  it("落点永远落在篮子够得到的横向范围里，不会藏在墙里", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const d of planDrops(LEVELS[seed % LEVELS.length], seed * 31, { count: 30 })) {
        expect(d.x).toBeGreaterThanOrEqual(BASKET_MIN_X - 1e-6);
        expect(d.x).toBeLessThanOrEqual(BASKET_MAX_X + 1e-6);
        expect(d.at).toBeGreaterThanOrEqual(0);
        expect(d.at).toBeLessThan(d.landAt);
        expect(d.vy).toBeGreaterThan(0);
      }
    }
  });

  it("同一个种子排出来的下落表一模一样（可复现）", () => {
    expect(planDrops(LEVELS[30], 2024, { count: 24 })).toEqual(planDrops(LEVELS[30], 2024, { count: 24 }));
    expect(planDrops(LEVELS[30], 2025, { count: 24 })).not.toEqual(planDrops(LEVELS[30], 2024, { count: 24 }));
  });

  it("reachSpan 扣掉了 15% 余量，fallSeconds 会算下落时间", () => {
    expect(reachSpan(1, 200, 0.15)).toBeCloseTo(170, 6);
    expect(reachSpan(-3)).toBe(0);
    expect(fallSeconds(240, 0, 480)).toBeCloseTo(2, 6);
    expect(fallSeconds(0)).toBe(Infinity);
    expect(clampBasket(-99)).toBe(BASKET_MIN_X);
    expect(clampBasket(9999)).toBe(BASKET_MAX_X);
  });

  it("hazardX 一定挑得出离篮子够远的位置，贴边时也不会返回篮子脚下", () => {
    for (const p of [BASKET_MIN_X, 100, 180, 260, BASKET_MAX_X]) {
      for (const r of [0, 0.25, 0.5, 0.99]) {
        const x = hazardX(p, r);
        expect(x).toBeGreaterThanOrEqual(BASKET_MIN_X - 1e-6);
        expect(x).toBeLessThanOrEqual(BASKET_MAX_X + 1e-6);
        expect(Math.abs(x - p)).toBeGreaterThanOrEqual(Math.min(HAZARD_CLEAR, BASKET_HALF + SNAP_PX));
      }
    }
  });

  it("predictBasket 描述的是「接完就赶路、到了就等」的篮子", () => {
    const chain = [
      { landAt: 1, x: 100 },
      { landAt: 3, x: 300 }
    ];
    expect(predictBasket(chain, 0, 100)).toBe(100);
    // 从 100 出发赶 300：1 秒只走 260 的一部分
    expect(predictBasket(chain, 1.5, 100)).toBeCloseTo(100 + 0.5 * BASKET_SPEED, 6);
    // 早就到了就站着等
    expect(predictBasket(chain, 2.9, 100)).toBe(300);
    expect(predictBasket(chain, 99, 100)).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// 二、吸附与接住判定
// ---------------------------------------------------------------------------

describe("接住小水果 · 篮口吸附", () => {
  it("差 8px 也算接住，差太多就是真漏了", () => {
    expect(isCaught(180 + BASKET_HALF + SNAP_PX, CATCH_Y, 180)).toBe(true);
    expect(isCaught(180 + BASKET_HALF + SNAP_PX + 1, CATCH_Y, 180)).toBe(false);
    expect(isCaught(180, CATCH_Y - 60, 180)).toBe(false);
  });

  it("磁铁生效时篮口再放宽一截，3 秒后自动收回", () => {
    const far = 180 + BASKET_HALF + SNAP_PX + MAGNET_EXTRA;
    expect(isCaught(far, CATCH_Y, 180)).toBe(false);
    expect(isCaught(far, CATCH_Y, 180, { magnet: true })).toBe(true);
    expect(MAGNET_SECONDS).toBe(3);
    expect(FREEZE_SECONDS).toBe(2);
  });

  it("接住沉水果之后篮子会慢一小段，之后自己恢复", () => {
    expect(basketSpeedNow(0.8)).toBeLessThan(BASKET_SPEED);
    expect(basketSpeedNow(0)).toBe(BASKET_SPEED);
  });
});

// ---------------------------------------------------------------------------
// 三、五种水果与道具
// ---------------------------------------------------------------------------

describe("接住小水果 · 五种水果与道具", () => {
  it("规格点名的五种全都在，普通 / 稀有 / 冰冻 / 磁铁 / 辣椒各有各的脾气", () => {
    for (const k of SPEC_KINDS) expect(FRUITS[k]).toBeTruthy();
    expect(FRUITS.gold.gain).toBeGreaterThan(FRUITS.fruit.gain);
    expect(FRUITS.freeze.effectSeconds).toBe(FREEZE_SECONDS);
    expect(FRUITS.magnet.effectSeconds).toBe(MAGNET_SECONDS);
    expect(FRUITS.chili.costsLife).toBe(true);
  });

  it("小辣椒掉得最慢、要画成一眼就知道别碰的样子（预警）", () => {
    expect(FRUITS.chili.fallMul).toBeLessThan(1);
    for (const k of Object.keys(FRUITS) as FruitKind[]) {
      if (k === "chili") continue;
      expect(FRUITS.chili.fallMul).toBeLessThanOrEqual(FRUITS[k].fallMul);
    }
    expect(FRUITS.chili.warn).toBe(true);
    expect(FRUITS.bad.warn).toBe(true);
    expect(FRUITS.fruit.warn).toBe(false);
  });

  it("漏掉道具和碰不得的东西都不扣爱心，只有真水果漏了才算", () => {
    expect(missCostsLife("fruit")).toBe(true);
    expect(missCostsLife("gold")).toBe(true);
    expect(missCostsLife("heavy")).toBe(true);
    expect(missCostsLife("chili")).toBe(false);
    expect(missCostsLife("bad")).toBe(false);
    expect(missCostsLife("freeze")).toBe(false);
    expect(missCostsLife("magnet")).toBe(false);
    expect(isHazard("bad")).toBe(true);
    expect(isHazard("gold")).toBe(false);
  });

  it("pickKind 按关卡概率分流，第 1 关永远只掉普通水果和金果", () => {
    for (let i = 0; i < 200; i++) {
      const k = pickKind(LEVELS[0], i / 200);
      expect(["fruit", "gold"]).toContain(k);
    }
    const late = new Set<FruitKind>();
    for (let i = 0; i < 400; i++) late.add(pickKind(LEVELS[187], i / 400));
    expect(late.has("chili")).toBe(true);
    expect(late.has("freeze")).toBe(true);
    expect(late.has("magnet")).toBe(true);
  });

  it("水果最小直径 32px，360px 上也抓得住", () => {
    expect(MIN_FRUIT_D).toBeGreaterThanOrEqual(32);
  });
});

// ---------------------------------------------------------------------------
// 四、计分：连接 5 颗给「稳稳的」倍率
// ---------------------------------------------------------------------------

describe("接住小水果 · 计分", () => {
  it("每连接 5 颗抬一档倍率，封顶 2 倍", () => {
    expect(steadyMul(0)).toBe(1);
    expect(steadyMul(4)).toBe(1);
    expect(steadyMul(5)).toBe(1.25);
    expect(steadyMul(10)).toBe(1.5);
    expect(steadyMul(999)).toBe(STEADY_MAX);
    expect(steadyMul(-5)).toBe(1);
  });

  it("稀有果比普通水果值钱，倍率上来之后同一颗更值钱", () => {
    expect(scoreFor("gold")).toBeGreaterThan(scoreFor("fruit"));
    expect(scoreFor("fruit", 10)).toBeGreaterThan(scoreFor("fruit", 0));
  });

  it("一颗爱心都不掉才是三星，掉光就三次机会用完", () => {
    expect(starsFor(0)).toBe(3);
    expect(starsFor(1)).toBe(2);
    expect(starsFor(2)).toBe(1);
    expect(MAX_MISS).toBe(3);
  });

  it("漏球的话只描述不批评，一句「笨」「差」都没有", () => {
    for (let i = 1; i <= 3; i++) {
      const w = missWord(i);
      expect(w.length).toBeGreaterThan(6);
      expect(w).not.toMatch(/笨|差劲|失败|输了|不行/);
    }
  });
});

// ---------------------------------------------------------------------------
// 五、风与传送带都不许破坏可达性
// ---------------------------------------------------------------------------

describe("接住小水果 · 风与传送带", () => {
  it("有风时水果一路摇摆，但落地那一刻的偏移恰好归零", () => {
    const landAt = 4;
    expect(windOffset(landAt, landAt, 1.2)).toBeCloseTo(0, 9);
    let swung = false;
    for (let t = 0; t < landAt; t += 0.1) if (Math.abs(windOffset(t, landAt, 1.2)) > 8) swung = true;
    expect(swung).toBe(true);
    expect(windOffset(1, 4, 0)).toBe(0);
  });

  it("传送带把水果从出生点滑到生成器算好的落点，滑完就是那个位置", () => {
    const planX = 240;
    const from = beltSpawnX(planX, 60, 1.3);
    expect(from).toBeLessThan(planX);
    expect(beltX(from, planX, 0)).toBeCloseTo(from, 6);
    expect(beltX(from, planX, 1)).toBeCloseTo(planX, 6);
    expect(beltX(from, planX, 5)).toBeCloseTo(planX, 6);
    // 反方向也不会滑出场地
    expect(beltSpawnX(40, -120, 1.3)).toBeLessThanOrEqual(W - 14);
    expect(beltSpawnX(40, 900, 1.3)).toBeGreaterThanOrEqual(14);
  });
});

// ---------------------------------------------------------------------------
// 六、双人同屏
// ---------------------------------------------------------------------------

describe("接住小水果 · 双人同屏", () => {
  it("鸭梨用 A/D、康康用方向键，两套键位写在数据里", () => {
    expect(PLAYERS.doudou.keys).toContain("A");
    expect(PLAYERS.doudou.keys).toContain("D");
    expect(PLAYERS.star.keys).toContain("←");
    expect(PLAYERS.star.keys).toContain("→");
  });

  it("左半屏归鸭梨、右半屏归康康，分数各记各的不串台", () => {
    expect(duoSide(10)).toBe("doudou");
    expect(duoSide(350)).toBe("star");
    let st = duoInit();
    st = duoCatch(st, "doudou", 2);
    st = duoCatch(st, "star", 1);
    st = duoMiss(st, "star");
    expect(st).toEqual({ doudou: 2, star: 1, missDoudou: 0, missStar: 1 });
    expect(duoWinner(st)).toBe("doudou");
    expect(duoWinner(duoInit())).toBe("tie");
  });

  it("谁先接满 30 颗就收工，收场词赢的夸、输的也夸", () => {
    expect(duoDone(duoInit())).toBe(false);
    expect(duoDone({ doudou: DUO_GOAL, star: 3, missDoudou: 0, missStar: 0 })).toBe(true);
    const word = duoWord({ doudou: DUO_GOAL, star: 12, missDoudou: 0, missStar: 2 });
    expect(word).toContain("鸭梨");
    expect(word).toContain("康康");
    expect(word).not.toMatch(/输|笨|差/);
    expect(duoWord(duoInit())).toContain("打平");
  });
});

// ---------------------------------------------------------------------------
// 七、无尽「水果雨」
// ---------------------------------------------------------------------------

describe("接住小水果 · 无尽水果雨", () => {
  it("越往后越密越快，但都有下限 / 上限，不会变成人类接不到的白噪声", () => {
    expect(rainSpawnMs(0)).toBeGreaterThan(rainSpawnMs(30));
    expect(rainSpawnMs(9999)).toBe(420);
    expect(rainSpeed(0)).toBeLessThan(rainSpeed(30));
    expect(rainSpeed(9999)).toBeCloseTo(2.1, 6);
  });

  it("同一个种子就是同一场雨，而且整场条条可达", () => {
    const a = rainPlan(777, 120);
    const b = rainPlan(777, 120);
    expect(a).toEqual(b);
    expect(rainPlan(778, 120)).not.toEqual(a);
    expect(checkReachable(a).ok).toBe(true);
    // 五种水果道具在长局里都要露面
    const kinds = new Set(a.map((d) => d.kind));
    for (const k of SPEC_KINDS) expect(kinds.has(k)).toBe(true);
  });

  it("接到辣椒扣一次机会、断连接，掉 3 次才收工", () => {
    let st = rainInit();
    st = rainCatch(st, "fruit");
    st = rainCatch(st, "gold");
    expect(st.combo).toBe(2);
    expect(st.score).toBeGreaterThan(0);
    st = rainCatch(st, "chili");
    expect(st.combo).toBe(0);
    expect(st.missed).toBe(1);
    expect(st.over).toBe(false);
    st = rainMiss(st, "fruit");
    st = rainMiss(st, "fruit");
    expect(st.missed).toBe(RAIN_MISS_LIMIT);
    expect(st.over).toBe(true);
    // 收工之后再怎么点都不再变
    expect(rainCatch(st, "gold")).toBe(st);
    expect(rainMiss(st, "fruit")).toBe(st);
  });

  it("漏掉奖励果和道具都不扣机会，只断连接", () => {
    let st = rainCatch(rainCatch(rainInit(), "fruit"), "fruit");
    st = rainMiss(st, "fruit", true);
    expect(st.missed).toBe(0);
    expect(st.combo).toBe(0);
    st = rainMiss(st, "magnet");
    expect(st.missed).toBe(0);
  });

  it("最长连接会留档，收场词只鼓励", () => {
    let st = rainInit();
    for (let i = 0; i < 7; i++) st = rainCatch(st, "fruit");
    expect(st.bestCombo).toBe(7);
    st = rainMiss(st, "fruit");
    expect(st.bestCombo).toBe(7);
    expect(rainWord(st, 9999)).not.toMatch(/输|笨|差/);
    expect(rainWord({ ...st, score: 5000 }, 100)).toContain("新纪录");
  });
});

// ---------------------------------------------------------------------------
// 八、188 关抽样：假玩家照着链走一趟就能达标，而且一次都不会被擦到
// ---------------------------------------------------------------------------

describe("接住小水果 · 188 关模拟", () => {
  it("抽样的每一关都能靠「照着落点走」达标，且零失误三星", () => {
    for (let lv = 0; lv < LEVELS.length; lv += 7) {
      const r = simulateLevel(LEVELS[lv], { seed: 1000 + lv });
      expect(r.hazardHits).toBe(0);
      if (!r.won) throw new Error(`第 ${lv + 1} 关没接满：${r.caught}/${r.target} 漏了 ${r.missed}`);
      expect(r.missed).toBe(0);
      expect(starsFor(r.missed)).toBe(3);
    }
  });

  it("换三个种子重跑，188 关一关不漏都能过", () => {
    for (const seed of [11, 2222, 33333]) {
      for (let lv = 0; lv < LEVELS.length; lv++) {
        const r = simulateLevel(LEVELS[lv], { seed: seed + lv });
        if (!r.won) throw new Error(`种子 ${seed} 第 ${lv + 1} 关没接满：${r.caught}/${r.target}`);
        expect(r.hazardHits).toBe(0);
      }
    }
  });

  it("漏掉的都是「明摆着够不着」的奖励果，绝不会因此丢爱心", () => {
    const r = simulateLevel(LEVELS[187], { seed: 4242 });
    expect(r.won).toBe(true);
    expect(r.missed).toBe(0);
    expect(r.bonusMissed).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 九、destroy 归零
// ---------------------------------------------------------------------------

describe("接住小水果 · 资源看管", () => {
  function fakeHost(): TimerHost & { timers: number; frames: number } {
    const state = { timers: 0, frames: 0 };
    let id = 1;
    return {
      timers: 0,
      frames: 0,
      get: () => state,
      setTimeout() {
        state.timers++;
        return id++;
      },
      clearTimeout() {
        state.timers--;
      },
      requestAnimationFrame() {
        state.frames++;
        return id++;
      },
      cancelAnimationFrame() {
        state.frames--;
      }
    } as unknown as TimerHost & { timers: number; frames: number };
  }

  it("定时器 / rAF / 两套键位监听在 destroy 之后一件不剩", () => {
    const jan = new Janitor(fakeHost());
    const target = {
      list: [] as string[],
      addEventListener(t: string) {
        this.list.push(t);
      },
      removeEventListener(t: string) {
        this.list.splice(this.list.indexOf(t), 1);
      }
    };
    jan.after(50, () => undefined);
    jan.frame(() => undefined);
    jan.on(target, "keydown", () => undefined);
    jan.on(target, "keyup", () => undefined);
    jan.on(target, "pointermove", () => undefined);
    expect(jan.pending()).toBe(5);
    expect(target.list).toHaveLength(3);
    jan.destroy();
    expect(jan.pending()).toBe(0);
    expect(target.list).toHaveLength(0);
    expect(jan.dead).toBe(true);
  });

  it("destroy 之后排队的回调不会再跑，拆监听报错也不会连累后面的", () => {
    let fired = 0;
    let cb: (() => void) | null = null;
    const host: TimerHost = {
      setTimeout(fn) {
        cb = fn;
        return 1;
      },
      clearTimeout() {
        /* 故意不真的取消，模拟「已经排进队列」的回调 */
      }
    };
    const jan = new Janitor(host);
    jan.after(0, () => fired++);
    let cleaned = 0;
    jan.own(() => {
      cleaned++;
      throw new Error("拆监听时出了点小状况");
    });
    jan.own(() => cleaned++);
    jan.destroy();
    cb?.();
    expect(fired).toBe(0);
    expect(cleaned).toBe(2);
    expect(jan.pending()).toBe(0);
  });
});
