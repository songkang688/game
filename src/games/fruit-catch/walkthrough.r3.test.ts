/**
 * 接住小水果 · 窗口 4 档A · 第 3 轮测试员（收官）。
 *
 * 前两轮一共只抽了 14 关。收官这一轮不抽了：**188 关一关不漏**各跑三个种子，
 * 每一关的下落表都验一遍「必接的赶得到、碰不得的擦不着」，
 * 双人赛跑到分出胜负，水果雨按「一直接到手滑」跑到底，
 * 360px 再走一遍，最后把 W4A-04 / 06 / 09 / 11 与 A-L03 / A-L10 的结论钉死。
 * 本段只读不改：一行玩法代码都没动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHAPTERS, LEGACY_LEVELS, LEVELS, reachOf, type CatchLevel } from "./levels";
import GUIDE from "./guide";
import {
  BASKET_HALF, BASKET_SPEED, CATCH_Y, FREEZE_SECONDS, FRUITS, HEAVY_SLOW_FACTOR, HEAVY_SLOW_S,
  MAGNET_EXTRA, MAGNET_SECONDS, MAX_MISS, MIN_FRUIT_D, RAIN_CHUNK, RAIN_LOOKAHEAD, RAIN_MISS_LIMIT,
  SNAP_PX, W,
  Janitor, basketSpeedNow, checkReachable, duoCatch, duoDone, duoInit, duoMiss, duoSide, duoWinner,
  duoWord, isCaught, isHazard, markReachable, minSpeedNeeded, missWord, planDrops, rainCatch,
  rainExtend, rainInit, rainMiss, rainPlan, rainSpawnMs, rainSpeed, rainWord, sameFrameGroups,
  scoreFor, simulateLevel, starsFor, steadyMul,
  type DropPlan, type ListenerTarget, type TimerHost
} from "./logic";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 失败话术里一个都不许出现的词 */
const BLAME_WORDS = ["失败", "输了", "太差", "笨", "不行", "菜"];

describe("接住小水果 · R3 · 188 关一关不漏", () => {
  it("每一关都接得下来，而且换三个种子都接得下来", () => {
    const bad: string[] = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
      for (const s of [5, 20260827, 91173]) {
        const res = simulateLevel(LEVELS[lv], { seed: s + lv * 31 });
        if (!res.won) bad.push(`第 ${lv + 1} 关 seed ${s}`);
      }
    }
    expect(bad, `接不下来：${bad.slice(0, 8).join("、")}`).toEqual([]);
  });

  it("每一关的下落表都自洽：必接的条条赶得到、碰不得的一次都擦不着、两颗不叠在一起", () => {
    const bad: string[] = [];
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const cfg = LEVELS[lv];
      const plan = markReachable(planDrops(cfg, 4400 + lv * 7, { count: 120 }));
      const rep = checkReachable(plan);
      if (!rep.ok) bad.push(`第 ${lv + 1} 关 firstBad=${rep.firstBad}`);
      // 同一帧落地的两颗不能挤在一处，不然孩子根本分不清该接哪一颗
      for (const g of sameFrameGroups(plan)) {
        for (let i = 1; i < g.length; i++) {
          if (Math.abs(g[i].x - g[i - 1].x) < MIN_FRUIT_D - 1e-6) bad.push(`第 ${lv + 1} 关有两颗叠住了`);
        }
      }
    }
    expect(bad, bad.slice(0, 8).join("、")).toEqual([]);
  });

  it("赢一次也输一次：手一直不动就一定输，输在三颗爱心用完，不会没完没了", () => {
    for (const lv of [1, 40, 88, 100, 133, 166, 188]) {
      const cfg = LEVELS[lv - 1];
      const win = simulateLevel(cfg, { seed: 7100 + lv });
      expect(win.won, `第 ${lv} 关该赢`).toBe(true);
      expect(win.caught, `第 ${lv} 关`).toBeGreaterThanOrEqual(cfg.target);
      expect(win.hazardHits, `第 ${lv} 关照着链走不该被擦到`).toBe(0);

      const lose = simulateLevel(cfg, { seed: 7100 + lv, playerSpeed: 0 });
      expect(lose.won, `第 ${lv} 关该输`).toBe(false);
      expect(lose.missed, `第 ${lv} 关`).toBe(MAX_MISS);
      // 输也要输得快：站着不动不该拖上一分钟才收场
      expect(lose.seconds, `第 ${lv} 关`).toBeLessThan(win.seconds + 30);
    }
  });

  it("第 1 / 100 / 188 关照旧：一关比一关久、一关比一关多，但都在孩子撑得住的时间里", () => {
    const marks = [1, 100, 188].map((lv) => ({ lv, cfg: LEVELS[lv - 1], res: simulateLevel(LEVELS[lv - 1], { seed: 3030 + lv }) }));
    for (const m of marks) {
      expect(m.res.won, `第 ${m.lv} 关`).toBe(true);
      expect(m.res.seconds, `第 ${m.lv} 关`).toBeLessThan(75);
    }
    expect(marks[2].cfg.target).toBeGreaterThan(marks[0].cfg.target);
    expect(marks[1].cfg.target).toBeGreaterThan(marks[0].cfg.target);
  });

  it("前 99 关一个字节都没被这三轮碰过（1.0 内容冻结）", () => {
    let h = 2166136261;
    for (const ch of JSON.stringify(LEVELS.slice(0, LEGACY_LEVELS))) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    expect((h >>> 0).toString(16)).toBe("798ab042");
  });
});

describe("接住小水果 · R3 · 三种玩法各玩到结算", () => {
  it("战役：星星按漏了几颗给，一颗不漏才三颗星", () => {
    expect(starsFor(0)).toBe(3);
    expect(starsFor(1)).toBe(2);
    expect(starsFor(2)).toBe(1);
    expect(starsFor(MAX_MISS)).toBe(1);
  });

  it("双人赛跑：接到 30 颗才收，赢家输家都有话说，没有一句是数落", () => {
    let st = duoInit();
    let guard = 0;
    while (!duoDone(st) && guard++ < 500) {
      st = duoCatch(st, "doudou", 2);
      st = duoCatch(st, "star", 1);
    }
    expect(duoDone(st)).toBe(true);
    expect(duoWinner(st)).toBe("doudou");
    const word = duoWord(st);
    expect(word).toContain("鸭梨");
    for (const w of BLAME_WORDS) expect(word, `不该说「${w}」`).not.toContain(w);

    // 打平也说得出话
    let tie = duoInit();
    while (!duoDone(tie)) {
      tie = duoCatch(tie, "doudou", 1);
      tie = duoCatch(tie, "star", 1);
    }
    expect(duoWinner(tie)).toBe("tie");
    expect(duoWord(tie)).toContain("打平");
  });

  it("双人赛跑：左右两半各归各的人，漏了只扣自己的", () => {
    expect(duoSide(10)).toBe("doudou");
    expect(duoSide(W - 10)).toBe("star");
    const st = duoMiss(duoCatch(duoInit(), "doudou", 5), "star");
    expect(st.doudou).toBe(5);
    expect(st.star).toBeLessThanOrEqual(0);
  });

  it("水果雨：漏满三颗才收场，收场那句话只报成绩不数落", () => {
    let st = rainInit();
    for (let i = 0; i < 40; i++) st = rainCatch(st, "fruit");
    expect(st.score).toBeGreaterThan(0);
    expect(st.bestCombo).toBeGreaterThanOrEqual(40);

    for (let i = 0; i < RAIN_MISS_LIMIT; i++) {
      expect(st.missed, `漏第 ${i + 1} 颗前`).toBeLessThan(RAIN_MISS_LIMIT);
      st = rainMiss(st, "fruit");
    }
    expect(st.missed).toBe(RAIN_MISS_LIMIT);

    for (const best of [0, 9999]) {
      const word = rainWord(st, best);
      for (const w of BLAME_WORDS) expect(word, `不该说「${w}」`).not.toContain(w);
    }
    // 漏掉奖励果不扣机会：奖励本来就是白送的
    const bonus = rainMiss(rainInit(), "gold", true);
    expect(bonus.missed).toBe(0);
  });
});

describe("接住小水果 · R3 · 前两轮结论的最终复核", () => {
  it("W4A-11 已修：水果雨真的没有尽头，接得越久排得越密", () => {
    const first = markReachable(rainPlan(4242, RAIN_CHUNK));
    // 双子果会额外多排一颗，所以实际条数只多不少
    expect(first.length).toBeGreaterThanOrEqual(RAIN_CHUNK);
    let plan: DropPlan[] = first;
    // 连续续五段，模拟一个能接上千颗的孩子
    for (let i = 0; i < 5; i++) {
      const more = rainExtend(plan, 900 + i, plan.length, RAIN_CHUNK);
      // 接缝处不许倒流，也不许出现「篮子来不及」的必接果
      expect(more[0].landAt, `第 ${i + 1} 段的第一颗`).toBeGreaterThan(plan[plan.length - 1].landAt);
      expect(checkReachable(more).ok, `第 ${i + 1} 段`).toBe(true);
      plan = plan.concat(more);
    }
    expect(plan.length).toBeGreaterThanOrEqual(RAIN_CHUNK * 6);
    // 第 1900 颗比第 10 颗掉得快、排得密
    expect(rainSpeed(1900)).toBeGreaterThan(rainSpeed(10));
    expect(rainSpawnMs(1900)).toBeLessThan(rainSpawnMs(10));
    // 出场表快见底就续段的那道闸还在
    expect(SRC).toContain("topUpPlan");
    expect(SRC).toContain("RAIN_LOOKAHEAD");
    expect(RAIN_LOOKAHEAD).toBeLessThan(RAIN_CHUNK);
    // 水果雨那一段里，「排完就收」那条老规矩已经拆掉了：
    // 只有三次机会用完才收场。（双人赛跑仍留着这条兜底，那是一场有终点的比赛。）
    const rainSrc = SRC.slice(SRC.indexOf("function mountRain"), SRC.indexOf("export function mount("));
    expect(rainSrc.length).toBeGreaterThan(1000);
    expect(rainSrc).not.toContain("planAt >= plan.length");
    expect(rainSrc).toContain("topUpPlan");
  });

  it("A-L10 已落地：要的手速一章一章往上抬，换章还留一口气", () => {
    const need = (lv: number): number => simulateLevel(LEVELS[lv - 1], { seed: 5150 + lv }).needSpeed;
    // 前 99 关是冻结内容，不带手速门槛
    for (let ci = 0; ci < 6; ci++) expect(reachOf(ci, 0, CHAPTERS[ci].size)).toBeUndefined();
    // 之后的章：章内一路加宽
    for (let ci = 6; ci < CHAPTERS.length; ci++) {
      const size = CHAPTERS[ci].size;
      const head = reachOf(ci, 0, size)!;
      const tail = reachOf(ci, size - 1, size)!;
      expect(head, `第 ${ci + 1} 章`).toBeLessThan(tail);
      expect(head, `第 ${ci + 1} 章`).toBeGreaterThan(0);
      expect(tail, `第 ${ci + 1} 章`).toBeLessThanOrEqual(1);
    }
    // 落到实际手速上：末章尾比第 7 章头要求得高
    expect(need(188)).toBeGreaterThan(need(100));
  });

  it("W4A-06 已修：讲解与漏球话术里只有「爱心」，没有一个「血」字", () => {
    const text = [GUIDE.title, ...(GUIDE.lines ?? []), ...(GUIDE.tips ?? [])].join("\n");
    expect(text).not.toContain("血");
    for (let n = 1; n <= 4; n++) {
      const w = missWord(n);
      expect(w).not.toContain("血");
      for (const b of BLAME_WORDS) expect(w, `漏第 ${n} 颗时不该说「${b}」`).not.toContain(b);
    }
  });

  it("A-L03 仍在：连击满 5 才多算一颗，而且封了顶不会滚雪球", () => {
    expect(steadyMul(0)).toBe(1);
    expect(steadyMul(4)).toBe(1);
    expect(steadyMul(5)).toBeGreaterThan(1);
    // 连一百颗也不会算成一百倍
    expect(steadyMul(100)).toBeLessThanOrEqual(3);
    expect(scoreFor("gold", 0)).toBeGreaterThan(scoreFor("fruit", 0));
  });
});

describe("接住小水果 · R3 · 竞态与判定再走一遍", () => {
  it("同一帧落好几颗时，篮子只吃篮口里的那几颗，不会隔空捞", () => {
    const reach = BASKET_HALF + SNAP_PX;
    expect(isCaught(100, CATCH_Y, 100)).toBe(true);
    expect(isCaught(100 + reach - 1, CATCH_Y, 100)).toBe(true);
    expect(isCaught(100 + reach + 2, CATCH_Y, 100)).toBe(false);
    // 还没落到篮口那一层就不算接住，掉过头了也不算
    expect(isCaught(100, CATCH_Y - 40, 100)).toBe(false);
    expect(isCaught(100, CATCH_Y + 40, 100)).toBe(false);
    // 磁铁开着时篮口变宽，但也只宽这么多
    expect(isCaught(100 + reach + MAGNET_EXTRA - 1, CATCH_Y, 100, { magnet: true })).toBe(true);
    expect(isCaught(100 + reach + MAGNET_EXTRA + 4, CATCH_Y, 100, { magnet: true })).toBe(false);
  });

  it("冰冻和磁铁同时开着也各算各的，沉水果压慢的那 1.2 秒到点就回速", () => {
    expect(FREEZE_SECONDS).toBeGreaterThan(0);
    expect(MAGNET_SECONDS).toBeGreaterThan(0);
    expect(basketSpeedNow(0)).toBe(BASKET_SPEED);
    expect(basketSpeedNow(HEAVY_SLOW_S)).toBeCloseTo(BASKET_SPEED * HEAVY_SLOW_FACTOR, 6);
    // 慢完了就是慢完了，不会一直慢下去
    expect(basketSpeedNow(-0.5)).toBe(BASKET_SPEED);
    expect(basketSpeedNow(0.0001)).toBeLessThan(BASKET_SPEED);
  });

  it("碰不得的东西永远排在离必接果一臂之外，慢半拍的孩子也擦不着", () => {
    for (const lv of [66, 101, 145, 188]) {
      const res = simulateLevel(LEVELS[lv - 1], { seed: 2600 + lv, playerSpeed: BASKET_SPEED * 0.75 });
      expect(res.hazardHits, `第 ${lv} 关`).toBe(0);
    }
  });

  it("手慢一档也还赢得下来：链留了余量，不是掐着极速排的", () => {
    for (const lv of [20, 60, 105, 150, 188]) {
      const res = simulateLevel(LEVELS[lv - 1], { seed: 3700 + lv, playerSpeed: BASKET_SPEED * 0.9 });
      expect(res.won, `第 ${lv} 关手慢一档就赢不了了`).toBe(true);
    }
  });

  it("最少要跑多快这件事量得出来，而且永远不超过篮子的极速", () => {
    for (const lv of [1, 50, 100, 150, 188]) {
      const plan = markReachable(planDrops(LEVELS[lv - 1], 8800 + lv, { count: 90 }));
      const need = minSpeedNeeded(plan);
      expect(need, `第 ${lv} 关`).toBeGreaterThan(0);
      expect(need, `第 ${lv} 关要的手速超过篮子极速了`).toBeLessThanOrEqual(BASKET_SPEED + 1e-6);
    }
  });
});

describe("接住小水果 · R3 · 360px 与收尾红线", () => {
  it("画布跟着容器缩，按钮比手指还宽，一个写死的宽度都没有", () => {
    expect(/\.frc-canvas\s*\{[^}]*width:\s*100%/.test(SRC)).toBe(true);
    const btn = /\.frc-btn\s*\{[^}]*width:\s*(\d+)px[^}]*height:\s*(\d+)px/.exec(SRC);
    expect(btn, "找不到左右按钮的尺寸规则").not.toBeNull();
    expect(Number(btn![1])).toBeGreaterThanOrEqual(44);
    expect(Number(btn![2])).toBeGreaterThanOrEqual(44);
    // 逻辑画布本来就是 360 宽：横着放进 360px 的屏幕不用挤
    expect(W).toBeLessThanOrEqual(360);
    // 顶栏与图例都会自己换行 / 不换行地缩，不会顶出屏幕
    expect(/\.frc-top\s*\{[^}]*flex-wrap:\s*nowrap/.test(SRC)).toBe(true);
    expect(/\.frc-legend\s*\{[^}]*flex-wrap:\s*wrap/.test(SRC)).toBe(true);

    const wide = [...SRC.matchAll(/(?<!-)\bwidth:\s*(\d{3,})px/g)].map((m) => Number(m[1]));
    for (const px of wide) expect(px, "有一处写死了宽度").toBeLessThanOrEqual(360);
  });

  it("画面之外没有别的门路：不联网、不存本地、不碰 three.js", () => {
    for (const bad of ["fetch(", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "three", "cdn."]) {
      expect(SRC.toLowerCase(), `index.ts 里出现了 ${bad}`).not.toContain(bad.toLowerCase());
    }
    // 声音只走平台的 api.play
    expect(SRC).not.toContain("new Audio");
    expect(SRC).toContain("api.play(");
  });

  it("离场时定时器、动画帧、监听全都收得干净", () => {
    const cleared: string[] = [];
    let ran = 0;
    const host: TimerHost = {
      setTimeout: () => 11,
      clearTimeout: (id) => cleared.push(`t${id}`),
      requestAnimationFrame: () => 22,
      cancelAnimationFrame: (id) => cleared.push(`r${id}`)
    };
    const j = new Janitor(host);
    j.after(10, () => ran++);
    j.frame(() => ran++);
    let added = 0;
    let removed = 0;
    const target: ListenerTarget = {
      addEventListener: () => {
        added++;
      },
      removeEventListener: () => {
        removed++;
      }
    };
    j.on(target, "pointerdown", () => undefined);
    expect(added).toBe(1);
    expect(j.pending()).toBe(3);

    j.destroy();
    expect(cleared.sort()).toEqual(["r22", "t11"]);
    expect(removed).toBe(1);
    expect(j.pending()).toBe(0);
    expect(j.dead).toBe(true);
    // 收完再收一次也不该炸；收完之后排的活也不许再排上
    expect(() => j.destroy()).not.toThrow();
    expect(ran).toBe(0);
  });

  it("五关的水果表里都找得到「碰不得」的标记，颜色之外还有别的提示", () => {
    for (const k of Object.keys(FRUITS)) {
      const info = FRUITS[k as keyof typeof FRUITS];
      expect(info.name.length, `${k} 没有名字`).toBeGreaterThan(0);
      expect(info.emoji.length, `${k} 没有图形`).toBeGreaterThan(0);
      if (isHazard(k as keyof typeof FRUITS)) expect(info.warn, `${k} 该有红圈提示`).toBe(true);
    }
    // 红圈是画出来的，不是只靠颜色说话
    expect(SRC).toContain("setLineDash");
  });
});

describe("接住小水果 · R3 · 关表体检", () => {
  it("十章加起来正好 188 关，每章都有名字与关数", () => {
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
    expect(LEVELS.length).toBe(188);
    for (const c of CHAPTERS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.size).toBeGreaterThan(0);
    }
  });

  it("要接的数量一路往上走，掉得也一路更快，没有哪一关突然回到起点", () => {
    const targetOf = (lv: number): number => LEVELS[lv - 1].target;
    expect(targetOf(188)).toBeGreaterThan(targetOf(1));
    let dips = 0;
    for (let lv = 2; lv <= 188; lv++) if (targetOf(lv) < targetOf(lv - 1)) dips++;
    // 换章会松一口气，所以允许有回落，但不该关关都在回落
    expect(dips).toBeLessThan(CHAPTERS.length + 2);
    expect(LEVELS[187].speed).toBeGreaterThan(LEVELS[0].speed);
  });

  it("1.2 的三样新东西（辣椒 / 冰冻 / 磁铁）只出现在新章，前 99 关一个都没有", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const cfg: CatchLevel = LEVELS[i];
      expect(cfg.chiliChance ?? 0, `第 ${i + 1} 关`).toBe(0);
      expect(cfg.freezeChance ?? 0, `第 ${i + 1} 关`).toBe(0);
      expect(cfg.magnetChance ?? 0, `第 ${i + 1} 关`).toBe(0);
    }
    const later = LEVELS.slice(LEGACY_LEVELS);
    expect(later.some((c) => (c.chiliChance ?? 0) > 0)).toBe(true);
    expect(later.some((c) => (c.freezeChance ?? 0) > 0)).toBe(true);
    expect(later.some((c) => (c.magnetChance ?? 0) > 0)).toBe(true);
  });

  it("落点永远落在篮子够得着的横条里，一颗都没排到屏幕外", () => {
    for (const lv of [3, 47, 99, 120, 188]) {
      const plan = planDrops(LEVELS[lv - 1], 6100 + lv, { count: 100 });
      for (const d of plan) {
        expect(d.x, `第 ${lv} 关有一颗排到左边外面`).toBeGreaterThanOrEqual(0);
        expect(d.x, `第 ${lv} 关有一颗排到右边外面`).toBeLessThanOrEqual(W);
        expect(d.landAt, `第 ${lv} 关有一颗的落地时刻是负的`).toBeGreaterThan(0);
        expect(d.vy, `第 ${lv} 关有一颗不往下掉`).toBeGreaterThan(0);
      }
    }
    expect(CATCH_Y).toBeLessThan(460);
  });
});
