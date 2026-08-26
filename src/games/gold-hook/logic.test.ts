/**
 * 金矿钩钩 · 玩法内核单测。
 *
 * 重点盯三样任务书点名要单测的纯函数:
 *  1. 摆动角度(三角波 + 反算等待时间);
 *  2. 回收速度(重量与力量水怎么影响它);
 *  3. 估值 / 商店 / 模拟器这几件「算账」的事。
 */
import { describe, expect, it } from "vitest";
import {
  BASE_RETRACT,
  EMPTY_RETRACT,
  EXTEND_SPEED,
  FIELD_H,
  FIELD_W,
  LUCK_STEP,
  MAX_LUCK,
  MAX_STRENGTH,
  MIN_RETRACT,
  ORES,
  ORE_KINDS,
  PIVOT_X,
  PIVOT_Y,
  SHOP,
  SHOP_KINDS,
  angleFromPivot,
  angularHalfWidth,
  buyItem,
  canBuy,
  distanceFromPivot,
  emptyWallet,
  freeGaps,
  haulTime,
  haulValue,
  hookAngle,
  hookTip,
  hookedOre,
  lanesOverlap,
  loseLine,
  oreX,
  ownedOf,
  retractSpeed,
  retractTime,
  ropeExhausted,
  shopPrice,
  simulateRun,
  starsForCoins,
  timeToWaveValue,
  triangleWave,
  useBomb,
  waitFor,
  winLine,
  type MineField,
  type Ore,
  type OreKind,
} from "./logic";

function ore(kind: OreKind, x: number, y: number, id = 0, run = 0): Ore {
  const p = ORES[kind];
  return { id, kind, x, y, value: p.value, weight: p.weight, radius: p.radius, runRange: run, runSpeed: run ? 40 : 0 };
}

function field(ores: Ore[], patch: Partial<MineField> = {}): MineField {
  return { ores, swingSpeed: 50, swingSpan: 64, phase: 0, ropeMax: 420, time: 60, ...patch };
}

// ---------------------------------------------------------------------------
// 摆动
// ---------------------------------------------------------------------------

describe("摆动角度是一条三角波", () => {
  it("零时刻从正中间出发", () => {
    expect(triangleWave(0, 50, 60)).toBeCloseTo(0, 6);
  });

  it("永远待在 [-span, span] 里,一步都不会摆出去", () => {
    for (let i = 0; i < 400; i++) {
      const v = triangleWave(i * 0.037, 73, 64, 21);
      expect(v).toBeGreaterThanOrEqual(-64.0001);
      expect(v).toBeLessThanOrEqual(64.0001);
    }
  });

  it("先涨到最右边再回到最左边:四分之一周期正好在端点", () => {
    const speed = 40;
    const span = 60;
    expect(triangleWave(span / speed, speed, span)).toBeCloseTo(span, 5);
    expect(triangleWave((3 * span) / speed, speed, span)).toBeCloseTo(-span, 5);
  });

  it("周期是 4 × span ÷ 速度", () => {
    const speed = 37;
    const span = 55;
    const period = (4 * span) / speed;
    for (const t of [0, 0.4, 1.3, 2.9]) {
      expect(triangleWave(t + period, speed, span, 13)).toBeCloseTo(triangleWave(t, speed, span, 13), 5);
    }
  });

  it("时间倒着走也不会崩(负数照样落在区间里)", () => {
    for (let i = 1; i <= 50; i++) {
      const v = triangleWave(-i * 0.13, 61, 70, 9);
      expect(Math.abs(v)).toBeLessThanOrEqual(70.0001);
    }
  });

  it("摆幅为 0 或速度为 0 时不会除零", () => {
    expect(triangleWave(3, 50, 0)).toBe(0);
    expect(triangleWave(3, 0, 60, 12)).toBe(12);
    expect(triangleWave(3, 0, 60, 900)).toBe(60);
  });
});

describe("反算「还要等多久才摆到这个角度」", () => {
  it("已经指着目标时不用等", () => {
    expect(timeToWaveValue(0, 0, 50, 60)).toBeCloseTo(0, 6);
  });

  it("等完那段时间,摆到的正好就是目标角度", () => {
    const speed = 47;
    const span = 66;
    for (let i = 0; i < 60; i++) {
      const now = i * 0.21;
      const target = -span + ((i * 7.3) % (2 * span));
      const wait = timeToWaveValue(now, target, speed, span, 17);
      expect(wait).toBeGreaterThanOrEqual(0);
      expect(triangleWave(now + wait, speed, span, 17)).toBeCloseTo(target, 4);
    }
  });

  it("最长也不会等过一个完整来回", () => {
    const speed = 55;
    const span = 60;
    const period = (4 * span) / speed;
    for (let i = 0; i < 80; i++) {
      expect(timeToWaveValue(i * 0.09, -30 + (i % 60), speed, span)).toBeLessThanOrEqual(period + 1e-6);
    }
  });

  it("目标超出摆幅时会夹到端点上,永远等得到", () => {
    const wait = timeToWaveValue(0, 200, 50, 60);
    expect(Number.isFinite(wait)).toBe(true);
    expect(triangleWave(wait, 50, 60)).toBeCloseTo(60, 4);
  });

  it("摆幅为 0 时不用等", () => {
    expect(timeToWaveValue(2, 10, 50, 0)).toBe(0);
  });
});

describe("钩子的几何", () => {
  it("hookAngle 用的就是这个矿洞自己的摆动参数", () => {
    const f = field([], { swingSpeed: 40, swingSpan: 60, phase: 0 });
    expect(hookAngle(f, 0)).toBeCloseTo(0, 6);
    expect(hookAngle(f, 60 / 40)).toBeCloseTo(60, 5);
  });

  it("角度 0 就是直直往下,正负角度左右对称", () => {
    const down = hookTip(0, 100);
    expect(down.x).toBeCloseTo(PIVOT_X, 6);
    expect(down.y).toBeCloseTo(PIVOT_Y + 100, 6);
    const left = hookTip(-40, 120);
    const right = hookTip(40, 120);
    expect(left.x + right.x).toBeCloseTo(2 * PIVOT_X, 5);
    expect(left.y).toBeCloseTo(right.y, 5);
  });

  it("放到某个角度某个长度,再反算回来还是同一组角度与距离", () => {
    for (const a of [-58, -20, 0, 17, 63]) {
      for (const len of [90, 240, 400]) {
        const p = hookTip(a, len);
        expect(angleFromPivot(p.x, p.y)).toBeCloseTo(a, 4);
        expect(distanceFromPivot(p.x, p.y)).toBeCloseTo(len, 4);
      }
    }
  });

  it("同一颗矿石埋得越深,占的扇面越窄", () => {
    const shallow = angularHalfWidth(ore("goldBig", PIVOT_X, PIVOT_Y + 120));
    const deep = angularHalfWidth(ore("goldBig", PIVOT_X, PIVOT_Y + 360));
    expect(deep).toBeLessThan(shallow);
  });

  it("会跑的地鼠按「半径 + 跑动半径」占道,比钉死的宽", () => {
    const still = angularHalfWidth(ore("mole", PIVOT_X, PIVOT_Y + 200));
    const runner = angularHalfWidth(ore("mole", PIVOT_X, PIVOT_Y + 200, 0, 40));
    expect(runner).toBeGreaterThan(still);
  });

  it("挤在一起的两颗算互相挡道,岔开老远的不算", () => {
    const a = ore("goldBig", PIVOT_X - 4, PIVOT_Y + 200, 0);
    const b = ore("goldBig", PIVOT_X + 4, PIVOT_Y + 200, 1);
    expect(lanesOverlap(a, b)).toBe(true);
    const far = ore("goldBig", PIVOT_X + 150, PIVOT_Y + 200, 2);
    expect(lanesOverlap(a, far)).toBe(false);
  });

  it("地鼠会左右跑,跑不出自己的区间;不会跑的钉在原地", () => {
    const runner = ore("mole", 180, 300, 0, 30);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 200; i++) {
      const x = oreX(runner, i * 0.07);
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
    expect(min).toBeGreaterThanOrEqual(150 - 1e-6);
    expect(max).toBeLessThanOrEqual(210 + 1e-6);
    expect(max - min).toBeGreaterThan(50);
    const still = ore("gem", 180, 300);
    expect(oreX(still, 4.2)).toBe(180);
  });

  it("钩尖落在谁身上就钩到谁,落在空处什么也钩不到", () => {
    const gem = ore("gem", 200, 300, 7);
    const f = field([gem]);
    expect(hookedOre(f, { x: 202, y: 302 }, 0)?.id).toBe(7);
    expect(hookedOre(f, { x: 60, y: 460 }, 0)).toBeNull();
  });

  it("绳子放到头、探到洞底或者贴上石壁,就该往回收了", () => {
    const f = field([], { ropeMax: 300 });
    expect(ropeExhausted(f, 300, { x: 180, y: 300 })).toBe(true);
    expect(ropeExhausted(f, 120, { x: 180, y: 200 })).toBe(false);
    expect(ropeExhausted(f, 120, { x: 2, y: 200 })).toBe(true);
    expect(ropeExhausted(f, 120, { x: FIELD_W - 2, y: 200 })).toBe(true);
    expect(ropeExhausted(f, 120, { x: 180, y: FIELD_H + 40 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 回收速度
// ---------------------------------------------------------------------------

describe("回收速度:越重越慢,力量水越多越快", () => {
  it("重量一路加上去,速度只降不升", () => {
    let prev = Infinity;
    for (let w = 0; w <= 40; w++) {
      const v = retractSpeed(w);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });

  it("同一件东西,力量水越多拉得越快", () => {
    const speeds = [0, 1, 2, 3].map((s) => retractSpeed(20, s));
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThan(speeds[i - 1]);
  });

  it("重量 0 时正好是基准速度", () => {
    expect(retractSpeed(0)).toBeCloseTo(BASE_RETRACT, 6);
  });

  it("重量等于换算单位时速度正好减半", () => {
    expect(retractSpeed(10)).toBeCloseTo(BASE_RETRACT / 2, 6);
  });

  it("再重也不会慢过下限,再多力量水也快不过空钩", () => {
    expect(retractSpeed(100000)).toBe(MIN_RETRACT);
    expect(retractSpeed(0, 99)).toBeLessThanOrEqual(EMPTY_RETRACT);
    expect(retractSpeed(0, 99)).toBe(retractSpeed(0, MAX_STRENGTH));
  });

  it("负重量、NaN 这类脏数据不会把速度算崩", () => {
    expect(retractSpeed(-5)).toBeCloseTo(BASE_RETRACT, 6);
    expect(Number.isFinite(retractSpeed(Number.NaN))).toBe(true);
    expect(Number.isFinite(retractSpeed(10, Number.NaN))).toBe(true);
  });

  it("回收时间就是距离除以回收速度", () => {
    const o = ore("boulder", 180, 300);
    expect(retractTime(o, 240, 1)).toBeCloseTo(240 / retractSpeed(o.weight, 1), 9);
  });

  it("一趟的总时间 = 等摆动 + 放绳 + 回收,三段都对得上", () => {
    const o = ore("gem", 220, 340, 0);
    const f = field([o]);
    const d = distanceFromPivot(o.x, o.y);
    const wait = waitFor(o, f, 0);
    expect(haulTime(o, f, 0)).toBeCloseTo(wait + d / EXTEND_SPEED + retractTime(o, d), 9);
  });

  it("同一颗矿石,喝了力量水这一趟就更快", () => {
    const o = ore("goldHuge", 200, 380, 0);
    const f = field([o]);
    expect(haulTime(o, f, 0, MAX_STRENGTH)).toBeLessThan(haulTime(o, f, 0, 0));
  });
});

// ---------------------------------------------------------------------------
// 估值与商店
// ---------------------------------------------------------------------------

describe("矿石估值", () => {
  it("矿石表里每一种都填齐了,而且钻石最值钱、石头最不值钱", () => {
    expect(ORE_KINDS.length).toBe(9);
    for (const kind of ORE_KINDS) {
      const p = ORES[kind];
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.value).toBeGreaterThan(0);
      expect(p.weight).toBeGreaterThan(0);
      expect(p.radius).toBeGreaterThan(0);
    }
    expect(ORES.gem.value).toBeGreaterThan(ORES.goldHuge.value);
    expect(ORES.pebble.value).toBeLessThan(ORES.nugget.value);
  });

  it("幸运石给矿物加价,对石头一点用都没有", () => {
    const gold = ore("goldBig", 180, 300);
    expect(haulValue(gold, 0)).toBe(ORES.goldBig.value);
    expect(haulValue(gold, 2)).toBe(Math.round(ORES.goldBig.value * (1 + 2 * LUCK_STEP)));
    const rock = ore("boulder", 180, 300);
    for (const luck of [0, 1, 2, 3]) expect(haulValue(rock, luck)).toBe(ORES.boulder.value);
  });

  it("幸运石带再多也只按上限算", () => {
    const gold = ore("goldSmall", 180, 300);
    expect(haulValue(gold, 99)).toBe(haulValue(gold, MAX_LUCK));
  });
});

describe("商店:只花关内金币", () => {
  it("三样道具都配了文案、价钱和上限", () => {
    expect(SHOP_KINDS).toEqual(["bomb", "power", "luck"]);
    for (const kind of SHOP_KINDS) {
      const e = SHOP[kind];
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.desc.length).toBeGreaterThan(0);
      expect(e.base).toBeGreaterThan(0);
      expect(e.max).toBeGreaterThan(0);
    }
  });

  it("买得越多下一件越贵", () => {
    for (const kind of SHOP_KINDS) {
      expect(shopPrice(kind, 0)).toBe(SHOP[kind].base);
      expect(shopPrice(kind, 2)).toBeGreaterThan(shopPrice(kind, 1));
    }
  });

  it("钱不够就买不了,钱包一分不少", () => {
    const poor = emptyWallet(1);
    expect(canBuy(poor, "power")).toBe(false);
    const after = buyItem(poor, "power");
    expect(after).toEqual(poor);
    expect(after).not.toBe(poor);
  });

  it("买得起就扣钱进货,原来的钱包对象不会被改", () => {
    const before = emptyWallet(500);
    const after = buyItem(before, "bomb");
    expect(before.coins).toBe(500);
    expect(before.bombs).toBe(0);
    expect(after.coins).toBe(500 - SHOP.bomb.base);
    expect(after.bombs).toBe(1);
  });

  it("买到上限就不许再买了", () => {
    let w = emptyWallet(100000);
    for (let i = 0; i < SHOP.luck.max; i++) w = buyItem(w, "luck");
    expect(ownedOf(w, "luck")).toBe(SHOP.luck.max);
    expect(canBuy(w, "luck")).toBe(false);
    expect(buyItem(w, "luck").coins).toBe(w.coins);
  });

  it("连着买三样,钱正好是三次报价加起来", () => {
    const start = emptyWallet(1000);
    const w = buyItem(buyItem(buyItem(start, "bomb"), "bomb"), "power");
    expect(w.coins).toBe(1000 - shopPrice("bomb", 0) - shopPrice("bomb", 1) - shopPrice("power", 0));
    expect(w.bombs).toBe(2);
    expect(w.strength).toBe(1);
  });

  it("炸药用一个少一个,没有了也不会变成负数", () => {
    const w = { ...emptyWallet(0), bombs: 1 };
    expect(useBomb(w).bombs).toBe(0);
    expect(useBomb(useBomb(w)).bombs).toBe(0);
    expect(w.bombs).toBe(1);
  });
});

describe("评星与结算文案", () => {
  it("目标的一倍半是三星,一点二倍是两星,刚过线是一星", () => {
    expect(starsForCoins(160, 100)).toBe(3);
    expect(starsForCoins(130, 100)).toBe(2);
    expect(starsForCoins(100, 100)).toBe(1);
  });

  it("目标是 0 或负数也不会把评星算崩", () => {
    expect(starsForCoins(10, 0)).toBe(3);
    expect(starsForCoins(0, -5)).toBe(1);
  });

  it("过关和没过关的话里都会把金币数说清楚", () => {
    expect(winLine(320, 200, 3)).toContain("320");
    expect(loseLine(150, 200)).toContain("150");
    expect(loseLine(190, 200)).toContain("10");
  });
});

// ---------------------------------------------------------------------------
// 空档装箱
// ---------------------------------------------------------------------------

describe("扇面空档(矿洞生成靠它给每颗矿分车道)", () => {
  it("一颗都没放时整条扇面都是空的", () => {
    expect(freeGaps([], -60, 60)).toEqual([{ lo: -60, hi: 60 }]);
  });

  it("中间占掉一段就剩左右两段", () => {
    expect(freeGaps([{ lo: -10, hi: 10 }], -60, 60)).toEqual([
      { lo: -60, hi: -10 },
      { lo: 10, hi: 60 },
    ]);
  });

  it("叠在一起的两段会先合并再挖", () => {
    expect(freeGaps([{ lo: -10, hi: 10 }, { lo: 5, hi: 30 }], -60, 60)).toEqual([
      { lo: -60, hi: -10 },
      { lo: 30, hi: 60 },
    ]);
  });

  it("整条扇面被占满就一个空档都不剩", () => {
    expect(freeGaps([{ lo: -80, hi: 80 }], -60, 60)).toEqual([]);
  });

  it("区间反了或者为空时安全返回空数组", () => {
    expect(freeGaps([], 30, 30)).toEqual([]);
    expect(freeGaps([], 40, 10)).toEqual([]);
  });

  it("挖出来的空档一定升序、互不相交,而且都在范围内", () => {
    const taken = [
      { lo: -50, hi: -40 },
      { lo: -20, hi: -5 },
      { lo: 12, hi: 18 },
      { lo: 15, hi: 33 },
    ];
    const gaps = freeGaps(taken, -60, 60);
    let cursor = -60;
    for (const g of gaps) {
      expect(g.lo).toBeGreaterThanOrEqual(cursor);
      expect(g.hi).toBeGreaterThan(g.lo);
      cursor = g.hi;
    }
    expect(cursor).toBeLessThanOrEqual(60);
  });
});

// ---------------------------------------------------------------------------
// 模拟器
// ---------------------------------------------------------------------------

describe("确定性模拟器", () => {
  const sample = field(
    [
      ore("gem", 210, 300, 0),
      ore("goldBig", 130, 380, 1),
      ore("nugget", 250, 200, 2),
      ore("boulder", 90, 260, 3),
      ore("goldHuge", 190, 460, 4),
    ],
    { time: 40 }
  );

  it("同样的输入永远给同样的结果", () => {
    const a = simulateRun(sample);
    const b = simulateRun(sample);
    expect(a).toEqual(b);
  });

  it("默认不钩石头,所以石头的 id 不会出现在清单里", () => {
    expect(simulateRun(sample).picked).not.toContain(3);
  });

  it("专挑石头钩的摆烂玩法只钩得到石头,而且钱少得可怜", () => {
    const lazy = simulateRun(sample, { strategy: "near", takeRocks: true, takeTreasure: false });
    expect(lazy.picked).toEqual([3]);
    expect(lazy.coins).toBeLessThan(simulateRun(sample).coins / 5);
  });

  it("时间越多挖得越多,绝不会倒着来", () => {
    let prev = -1;
    for (const time of [6, 12, 20, 30, 45, 80]) {
      const got = simulateRun({ ...sample, time }).coins;
      expect(got).toBeGreaterThanOrEqual(prev);
      prev = got;
    }
  });

  it("用掉的时间不会超过这一关给的时间", () => {
    for (const time of [8, 17, 26, 55]) {
      expect(simulateRun({ ...sample, time }).timeUsed).toBeLessThanOrEqual(time + 1e-9);
    }
  });

  it("时间给到管够时,全部矿物都会被钩上来", () => {
    const all = simulateRun({ ...sample, time: Number.POSITIVE_INFINITY });
    expect(all.hauls).toBe(4);
    expect([...all.picked].sort()).toEqual([0, 1, 2, 4]);
  });

  it("手不准会让成绩变差,但不会凭空多出钱来", () => {
    const clean = simulateRun({ ...sample, time: 26 }).coins;
    const clumsy = simulateRun({ ...sample, time: 26 }, { timePenalty: 0.3 }).coins;
    expect(clumsy).toBeLessThanOrEqual(clean);
  });

  it("幸运石只涨钱不省时间:钩的还是同一批,钱变多了", () => {
    const plain = simulateRun({ ...sample, time: 26 });
    const lucky = simulateRun({ ...sample, time: 26 }, { luck: MAX_LUCK });
    expect(lucky.coins).toBeGreaterThan(plain.coins);
  });

  it("力量水能让同样的时间里多钩几趟", () => {
    const plain = simulateRun({ ...sample, time: 22 });
    const strong = simulateRun({ ...sample, time: 22 }, { strength: MAX_STRENGTH });
    expect(strong.hauls).toBeGreaterThanOrEqual(plain.hauls);
    expect(strong.coins).toBeGreaterThanOrEqual(plain.coins);
  });

  it("性价比优先的策略比「只挑最值钱的」更会用时间", () => {
    const tight = { ...sample, time: 14 };
    expect(simulateRun(tight, { strategy: "greedy" }).coins).toBeGreaterThanOrEqual(
      simulateRun(tight, { strategy: "value" }).coins
    );
  });

  it("会跑的地鼠默认不算进来(当纯赚头),打开开关才会去钩", () => {
    const withMole = field([ore("gem", 210, 300, 0), ore("mole", 140, 320, 1, 30)], { time: 40 });
    expect(simulateRun(withMole).picked).toEqual([0]);
    expect(simulateRun(withMole, { takeMoles: true }).picked).toContain(1);
  });

  it("够不着的矿石(超出绳长)直接不列入计划", () => {
    const tooFar = field([ore("gem", 180, PIVOT_Y + 500, 0)], { ropeMax: 200, time: 60 });
    expect(simulateRun(tooFar).hauls).toBe(0);
  });

  it("空矿洞不会把模拟器卡死", () => {
    const empty = simulateRun(field([]));
    expect(empty).toEqual({ coins: 0, hauls: 0, timeUsed: 0, picked: [] });
  });
});
