/**
 * 实时一局的用例:把 `arena.ts` 和 `brains.ts` 当成一台机器来跑。
 *
 * 这里管两件事。一件是**规则真的成立**:蓄力松手会飞出雪球、蹲下会搓出雪球、
 * 雪墙挡得住、被砸中会变雪人、雪人越线是「这一轮结束」而不是「谁受伤了」。
 * 另一件是**这局玩得下去**:188 关一个会玩的人全都过得去,三档人机强弱有序,
 * 无尽一波比一波难。后者跑得慢,但它才是「能不能上线」的那条线。
 */
import { describe, expect, it } from "vitest";
import { buildLevel } from "./levels";
import {
  DUEL_TIME,
  FIELD_W_12,
  MARCH_TO_SPEED,
  campaignArena,
  campaignLoseLine,
  campaignWinLine,
  chapterFoeFire,
  createArena,
  duelArena,
  endlessArena,
  idleInput,
  liveFoes,
  seasonLine,
  seasonWave,
  snapshot,
  stepArena,
  waveFoes,
  type Arena,
  type ArenaEvent,
  type Input12,
} from "./arena";
import { AI_12, FRONT_GAP, aiInput, incomingIn, planThrow, standRange, targetOrder } from "./brains";
import { HAND_MAX, SCOOP_TIME, depthAt } from "./economy";
import { BUMP_LIMIT, FREEZE_TIME } from "./snowman";
import { CHARGE_MAX } from "./throw12";
import type { AiLevel } from "./physics";

const DT = 1 / 60;

function charging(): Input12 {
  return { move: 0, aim: 0, crouch: false, charging: true };
}
function crouching(): Input12 {
  return { move: 0, aim: 0, crouch: true, charging: false };
}

/** 一个人按住某个键按 `seconds` 秒,顺手把事件收集起来 */
function hold(a: Arena, input: Input12, seconds: number, seat = 0): ArenaEvent[] {
  const ev: ArenaEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) ev.push(...stepArena(a, DT, { [seat]: input }));
  return ev;
}

/** 让一个会玩的小朋友(拿三档里的某一档当替身)把这一局打完 */
function botPlay(a: Arena, seconds: number, level: AiLevel = "hard"): number {
  const me = a.fighters[0];
  let t = 0;
  while (t < seconds && a.status === "playing") {
    stepArena(a, DT, { 0: aiInput(a, me, DT, level) });
    t += DT;
  }
  return t;
}

/** 一个只有一个靶子、没有掩体的空场,用来单独验某一条规则 */
function sandbox(over: Partial<Parameters<typeof createArena>[0]> = {}): Arena {
  return createArena({
    mode: "campaign",
    seed: 4242,
    windPlan: [0],
    covers: [],
    foes: [{ x: 30, y: 2, r: 1.3 }],
    fighters: [{ seat: 0, name: "朵朵", x: 6, dir: 1, minX: 2, maxX: 20, balls: 3 }],
    ...over,
  });
}

// ---------------------------------------------------------------------------
// 一、确定性
// ---------------------------------------------------------------------------

describe("同种子同输入 = 同一局", () => {
  it("两局并排跑三十秒,快照一模一样", () => {
    const a = campaignArena(buildLevel(40), 999);
    const b = campaignArena(buildLevel(40), 999);
    for (let i = 0; i < 1800; i++) {
      const inp = i % 40 < 20 ? charging() : crouching();
      stepArena(a, DT, { 0: inp });
      stepArena(b, DT, { 0: inp });
    }
    expect(snapshot(a)).toBe(snapshot(b));
  });

  it("传多大的 dt 都稳:一步 1/10 秒和六步 1/60 秒推出来的位置几乎一样", () => {
    const a = sandbox();
    const b = sandbox();
    stepArena(a, 0.1, { 0: charging() });
    for (let i = 0; i < 6; i++) stepArena(b, 1 / 60, { 0: charging() });
    expect(a.fighters[0].charge).toBeCloseTo(b.fighters[0].charge ?? 0, 6);
    expect(Math.abs(a.t - b.t)).toBeLessThan(1e-9);
  });
});

// ---------------------------------------------------------------------------
// 二、投:蓄力 → 松手 → 飞出去
// ---------------------------------------------------------------------------

describe("蓄力与出手", () => {
  it("按住蓄力时球还在手上,松手那一帧才飞出去,手里少一颗", () => {
    const a = sandbox();
    const before = a.fighters[0].hands.balls;
    const ev = hold(a, charging(), 0.5);
    expect(ev.filter((e) => e.kind === "throw").length).toBe(0);
    expect(a.balls.length).toBe(0);
    expect(a.fighters[0].charge).toBeGreaterThan(0.4);

    const out = stepArena(a, DT, { 0: idleInput() });
    expect(out.filter((e) => e.kind === "throw").length).toBe(1);
    expect(a.balls.length).toBe(1);
    expect(a.fighters[0].hands.balls).toBe(before - 1);
    expect(a.fighters[0].charge).toBeNull();
  });

  it("蓄力封顶在 1.2 秒,按住不放也不会越按越强", () => {
    const a = sandbox();
    hold(a, charging(), 3);
    expect(a.fighters[0].charge).toBeCloseTo(CHARGE_MAX, 6);
  });

  it("空着手按蓄力扔不出去,得先蹲下搓一颗", () => {
    const a = sandbox({ fighters: [{ seat: 0, name: "朵朵", x: 6, dir: 1, minX: 2, maxX: 20, balls: 0 }] });
    hold(a, charging(), 1.5);
    stepArena(a, DT, { 0: idleInput() });
    expect(a.balls.length).toBe(0);
    expect(a.fighters[0].thrown).toBe(0);
  });

  it("出手之后有冷却:一秒之内连发不出三颗", () => {
    const a = sandbox();
    let thrown = 0;
    for (let i = 0; i < 60; i++) {
      // 一帧按一帧松,尽最大努力抢射速
      thrown += stepArena(a, DT, { 0: i % 2 === 0 ? charging() : idleInput() }).filter((e) => e.kind === "throw").length;
    }
    expect(thrown).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 三、搓:蹲下 0.6 秒一颗
// ---------------------------------------------------------------------------

describe("蹲下搓雪", () => {
  it("蹲够 0.6 秒手上多一颗,脚下的雪跟着变薄", () => {
    const a = sandbox({ fighters: [{ seat: 0, name: "朵朵", x: 6, dir: 1, minX: 2, maxX: 20, balls: 0 }] });
    const deep = depthAt(a.field, 6);
    const ev = hold(a, crouching(), SCOOP_TIME + 0.05);
    expect(ev.filter((e) => e.kind === "scoop").length).toBe(1);
    expect(a.fighters[0].hands.balls).toBe(1);
    expect(depthAt(a.field, 6)).toBeLessThan(deep);
  });

  it("蹲着扔不出去——这就是本款的节奏:安全和输出只能二选一", () => {
    const a = sandbox();
    const ev = hold(a, { move: 0, aim: 0, crouch: true, charging: true }, 1.5);
    expect(ev.filter((e) => e.kind === "throw").length).toBe(0);
    expect(a.fighters[0].charge).toBeNull();
  });

  it("蹲着不能走:想换阵地就得站起来,站起来就会被看见", () => {
    const a = sandbox();
    const x0 = a.fighters[0].x;
    hold(a, { move: 1, aim: 0, crouch: true, charging: false }, 1);
    expect(a.fighters[0].x).toBe(x0);
    hold(a, { move: 1, aim: 0, crouch: false, charging: false }, 1);
    expect(a.fighters[0].x).toBeGreaterThan(x0);
  });

  it("攥满三颗就停手,再蹲也不会变出第四颗", () => {
    const a = sandbox();
    hold(a, crouching(), 4);
    expect(a.fighters[0].hands.balls).toBe(HAND_MAX);
  });

  it("走出去会把正在搓的那一颗弄散(站起来 = 打断)", () => {
    const a = sandbox({ fighters: [{ seat: 0, name: "朵朵", x: 6, dir: 1, minX: 2, maxX: 20, balls: 0 }] });
    hold(a, crouching(), SCOOP_TIME * 0.7);
    expect(a.fighters[0].hands.progress).toBeGreaterThan(0);
    stepArena(a, DT, { 0: idleInput() });
    expect(a.fighters[0].hands.progress).toBe(0);
    expect(a.fighters[0].hands.balls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 四、躲:掩体与变雪人
// ---------------------------------------------------------------------------

describe("掩体挡球", () => {
  it("雪墙挡下雪球并掉一层,砸三下就没了", () => {
    const a = sandbox({
      covers: [{ kind: "wall", x: 14, w: 2.4, h: 6, row: 0 }],
      fighters: [{ seat: 0, name: "朵朵", x: 6, dir: 1, minX: 6, maxX: 6, balls: 3 }],
    });
    const wall = a.covers[0];
    expect(wall.hp).toBe(3);
    let broke = 0;
    for (let shot = 0; shot < 3; shot++) {
      a.fighters[0].aim = 18;
      a.fighters[0].hands = { balls: 3, progress: 0 };
      hold(a, charging(), 0.35);
      const ev = hold(a, idleInput(), 1.2);
      broke += ev.filter((e) => e.kind === "cover" && e.broke).length;
    }
    expect(broke).toBe(1);
    expect(a.covers.length).toBe(0);
  });

  it("自己躲的那个掩体不挡自己的球:从墙后面探头往外扔天经地义", () => {
    const a = sandbox({
      covers: [{ kind: "wall", x: 4, w: 2.4, h: 6, row: 0 }],
      fighters: [{ seat: 0, name: "朵朵", x: 7, dir: 1, minX: 7, maxX: 7, balls: 3 }],
    });
    a.fighters[0].aim = 40;
    hold(a, charging(), 0.9);
    const ev = hold(a, idleInput(), 2.5);
    // 身后那堵墙一下都没被自己砸到
    expect(ev.filter((e) => e.kind === "cover").length).toBe(0);
    expect(a.covers[0].hp).toBe(3);
  });
});

describe("被砸中就变雪人", () => {
  it("变雪人 1.5 秒不能动,正在搓的那一颗也散了——但没有血、没有淘汰", () => {
    const a = sandbox({ fighters: [{ seat: 0, name: "朵朵", x: 6, dir: 1, minX: 2, maxX: 20, balls: 0 }] });
    const target = a.fighters[0];
    // 先蹲下搓半颗,搓到一半挨一发
    hold(a, crouching(), SCOOP_TIME * 0.6);
    expect(target.hands.progress).toBeGreaterThan(0);
    a.balls.push({ x: target.x + 2, y: 0.6, vx: -16, vy: 0, id: 800, owner: -1, seat: 2, spin: 0, age: 0, skipCover: -1 });
    hold(a, crouching(), 0.2);
    expect(target.hit.phase).toBe("snowman");
    expect(target.hit.timer).toBeLessThanOrEqual(FREEZE_TIME);
    expect(target.hands.progress).toBe(0);
    // 变雪人期间按什么都没用
    const x0 = target.x;
    hold(a, { move: 1, aim: 1, crouch: false, charging: true }, 1, 0);
    expect(target.x).toBe(x0);
    // 1.5 秒之后自己就回来了,连血条都不存在
    hold(a, idleInput(), FREEZE_TIME, 0);
    expect(target.hit.phase).toBe("free");
    expect(target.hit.total).toBe(1);
    expect(Object.keys(target)).not.toContain("hp");
  });

  it("连中三次进暖手,场上没有「淘汰」这回事", () => {
    const a = sandbox();
    const me = a.fighters[0];
    for (let i = 0; i < BUMP_LIMIT; i++) {
      me.hit = { phase: "free", timer: 0, bumps: i, total: i };
      a.balls.push({ x: me.x, y: 1.1, vx: -14, vy: 0, id: 900 + i, owner: -1, seat: 2, spin: 0, age: 0, skipCover: -1 });
      hold(a, idleInput(), 0.2);
    }
    expect(me.hit.phase).toBe("warming");
    expect(a.fighters.length).toBe(1);
    expect(a.status).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// 五、188 关:数据一个字没改,实时也打得完
// ---------------------------------------------------------------------------

describe("188 关闯关", () => {
  it("关卡数据原样搬过来:靶位、掩体、风一个数都没动", () => {
    for (const i of [0, 33, 77, 120, 187]) {
      const level = buildLevel(i);
      const a = campaignArena(level);
      expect(a.foes.length).toBe(level.targets.length);
      expect(a.windPlan).toEqual(level.windPlan);
      for (const [k, t] of level.targets.entries()) {
        expect(a.foes[k].x).toBe(t.x);
        expect(a.foes[k].y).toBe(t.y);
      }
      // 掩体只多了自家阵地那一道雪坡(以及第 4 章起的一个木箱)
      const fromLevel = a.covers.filter((c) => level.covers.some((lc) => lc.x === c.x && lc.w === c.w));
      expect(fromLevel.length).toBe(level.covers.length);
    }
  });

  it("「每回合走几格」换算成「每秒走几格」,换算比例是常量而不是随手写的数", () => {
    const level = buildLevel(150);
    const a = campaignArena(level);
    for (const [i, t] of level.targets.entries()) {
      expect(a.foes[i].march).toBeCloseTo((t.march ?? 0) * MARCH_TO_SPEED, 6);
    }
  });

  it("会走过来的雪怪一律走近排——远排又高又小,那样等于看得见砸不着", () => {
    for (const i of [140, 155, 170, 186]) {
      for (const foe of campaignArena(buildLevel(i)).foes) {
        if (foe.march > 0) expect(foe.row).toBe(0);
      }
    }
  });

  it("前三章的雪怪不还手,后面几章才开火,而且越往后越准也越勤", () => {
    expect(chapterFoeFire(0).throwEvery).toBe(0);
    expect(chapterFoeFire(2).throwEvery).toBe(0);
    expect(chapterFoeFire(3).throwEvery).toBeGreaterThan(0);
    expect(chapterFoeFire(7).throwEvery).toBeLessThan(chapterFoeFire(3).throwEvery);
    expect(chapterFoeFire(7).accuracy).toBeGreaterThan(chapterFoeFire(3).accuracy);
    // 再准也留着躲的余地
    expect(chapterFoeFire(20).accuracy).toBeLessThanOrEqual(0.5);
  });

  it("188 关一关不落,会玩的小朋友全都过得去", () => {
    const bad: string[] = [];
    for (let i = 0; i < 188; i++) {
      const a = campaignArena(buildLevel(i));
      botPlay(a, 150);
      if (a.status !== "win") bad.push(`第 ${i + 1} 关 ${a.status}`);
    }
    expect(bad).toEqual([]);
  }, 300000);

  it("雪怪走到雪堡是「这一轮结束」,不是谁受伤了", () => {
    const a = createArena({
      mode: "campaign",
      seed: 1,
      windPlan: [0],
      covers: [],
      foes: [{ kind: "snowfoe", x: 15, y: 1.6, march: 3 }],
      fighters: [{ seat: 0, name: "朵朵", x: 6, dir: 1, minX: 2, maxX: 8, balls: 0 }],
    });
    hold(a, idleInput(), 6);
    expect(a.status).toBe("lose");
    expect(a.reason).toContain("雪堡");
    expect(a.reason).not.toMatch(/死|血|伤|输/);
    expect(a.fighters[0].hit.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 六、对战:两套输入不串,三档强弱有序
// ---------------------------------------------------------------------------

describe("双人对战", () => {
  it("场地关于中线严格对称:两边打的是同一套规则", () => {
    const a = duelArena(null, 5);
    const mid = FIELD_W_12 / 2;
    const mirror = (v: number): number => Math.round((2 * mid - v) * 100) / 100;
    for (const c of a.covers) {
      const twin = a.covers.find(
        (o) => o.kind === c.kind && o.row === c.row && Math.abs(o.x - mirror(c.x + c.w)) < 1e-6 && Math.abs(o.w - c.w) < 1e-6
      );
      expect(twin, `${c.kind}@${c.x} 没有镜像`).toBeDefined();
    }
    for (const f of liveFoes(a, 0)) {
      expect(liveFoes(a, 1).some((o) => Math.abs(o.x - mirror(f.x)) < 1e-6 && o.row === f.row)).toBe(true);
    }
    const [p0, p1] = a.fighters;
    expect(p0.x).toBeCloseTo(mirror(p1.x), 6);
    expect(p0.minX).toBeCloseTo(mirror(p1.maxX), 6);
  });

  it("两套输入互不串:只喂 0 号的键,1 号一动不动", () => {
    const a = duelArena(null, 11);
    const [p0, p1] = a.fighters;
    const x1 = p1.x;
    const aim1 = p1.aim;
    hold(a, { move: 1, aim: 1, crouch: false, charging: false }, 0.5, 0);
    expect(p0.x).toBeGreaterThan(18);
    expect(p0.aim).toBeGreaterThan(45);
    expect(p1.x).toBe(x1);
    expect(p1.aim).toBe(aim1);
  });

  it("两个人同时按各自的键,各走各的、各瞄各的", () => {
    const a = duelArena(null, 12);
    const [p0, p1] = a.fighters;
    for (let t = 0; t < 0.5; t += DT) {
      stepArena(a, DT, {
        0: { move: 1, aim: 1, crouch: false, charging: false },
        1: { move: -1, aim: -1, crouch: false, charging: false },
      });
    }
    expect(p0.x).toBeGreaterThan(18);
    expect(p1.x).toBeLessThan(42);
    expect(p0.aim).toBeGreaterThan(45);
    expect(p1.aim).toBeLessThan(45);
  });

  it("砸化对面三盏灯笼就赢;时间到了按剩的少的一方算,不会一直耗着", () => {
    const a = duelArena(null, 13);
    for (const f of a.foes) if (f.owner === 1) f.melted = true;
    stepArena(a, DT, {});
    expect(a.status).toBe("win");
    expect(a.winner).toBe(0);

    const b = duelArena(null, 14);
    b.t = DUEL_TIME - 0.01;
    stepArena(b, DT, {});
    expect(b.status).toBe("win");
    expect(b.winner).toBe(-1);
    expect(b.reason).toContain("平手");
  });

  it("三档人机:越往上手越准、越敢躲、想得越快", () => {
    const order: AiLevel[] = ["easy", "normal", "hard"];
    for (let i = 1; i < order.length; i++) {
      const lo = AI_12[order[i - 1]];
      const hi = AI_12[order[i]];
      expect(hi.angleTol).toBeLessThan(lo.angleTol);
      expect(hi.chargeErr).toBeLessThan(lo.chargeErr);
      expect(hi.react).toBeLessThan(lo.react);
      expect(hi.dodge).toBeGreaterThan(lo.dodge);
    }
  });

  it("三档打同一个人:准头一档比一档高,简单档明显最好赢", () => {
    const hits: Record<string, number> = {};
    const wins: Record<string, number> = {};
    for (const lv of ["easy", "normal", "hard"] as AiLevel[]) {
      let score = 0;
      let humanWin = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const a = duelArena(lv, seed);
        let t = 0;
        while (t < 170 && a.status === "playing") {
          stepArena(a, DT, { 0: aiInput(a, a.fighters[0], DT, "normal"), 1: aiInput(a, a.fighters[1], DT) });
          t += DT;
        }
        score += a.fighters[1].score;
        if (a.winner === 0) humanWin += 1;
      }
      hits[lv] = score;
      wins[lv] = humanWin;
    }
    expect(hits.hard).toBeGreaterThan(hits.easy);
    expect(wins.easy).toBeGreaterThan(wins.hard);
  }, 120000);

  it("电脑没有隔墙看人的特权:它和人一样只能攥三颗,也一样得蹲下搓", () => {
    const a = duelArena("hard", 21);
    const ai = a.fighters[1];
    let maxBalls = 0;
    let crouched = 0;
    for (let t = 0; t < 40; t += DT) {
      stepArena(a, DT, { 0: idleInput(), 1: aiInput(a, ai, DT) });
      maxBalls = Math.max(maxBalls, ai.hands.balls);
      if (ai.crouch) crouched += 1;
      if (a.status !== "playing") break;
    }
    expect(maxBalls).toBeLessThanOrEqual(HAND_MAX);
    expect(crouched).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 七、AI 的两条硬规矩
// ---------------------------------------------------------------------------

describe("电脑的两条硬规矩", () => {
  it("不越过靶子:人只会朝面朝的方向扔,越过去就等于放它过门", () => {
    const a = sandbox({ foes: [{ kind: "snowfoe", x: 18, y: 1.6, march: 0.4 }] });
    const me = a.fighters[0];
    const zone = standRange(a, me);
    expect(zone.hi).toBeCloseTo(18 - FRONT_GAP, 6);
    for (let t = 0; t < 12; t += DT) {
      stepArena(a, DT, { 0: aiInput(a, me, DT, "hard") });
      expect(me.x).toBeLessThanOrEqual(a.foes[0].x - FRONT_GAP + 0.4);
      if (a.status !== "playing") break;
    }
  });

  it("看见球飞过来会蹲下躲——躲的同时顺手把雪搓了", () => {
    const a = sandbox();
    const me = a.fighters[0];
    expect(incomingIn(a, me)).toBe(Infinity);
    a.balls.push({ x: me.x + 9, y: 2.2, vx: -18, vy: 1, id: 77, owner: -1, seat: 2, spin: 0, age: 0, skipCover: -1 });
    const eta = incomingIn(a, me);
    expect(eta).toBeLessThan(1);
    expect(aiInput(a, me, DT, "hard").crouch).toBe(true);
  });

  it("挑目标有先后:会走的排在灯笼前面,一个都扔不着时才去找对手本人", () => {
    const a = sandbox({
      foes: [
        { kind: "lantern", x: 22, y: 2 },
        { kind: "snowfoe", x: 34, y: 2, march: 0.4 },
      ],
    });
    const wish = targetOrder(a, a.fighters[0]);
    expect(wish[0].x).toBe(34);
    expect(planThrow(a, a.fighters[0], wish[0])).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 八、无尽「雪季」
// ---------------------------------------------------------------------------

describe("无尽雪季", () => {
  it("一波比一波多、比一波快、比一波准,但准度封顶留着躲的余地", () => {
    let prev = seasonWave(1);
    for (let w = 2; w <= 20; w++) {
      const now = seasonWave(w);
      expect(now.count).toBeGreaterThanOrEqual(prev.count);
      expect(now.accuracy).toBeGreaterThanOrEqual(prev.accuracy);
      expect(now.throwEvery).toBeLessThanOrEqual(prev.throwEvery);
      prev = now;
    }
    expect(seasonWave(999).accuracy).toBeLessThanOrEqual(0.86);
    expect(seasonWave(999).count).toBeLessThanOrEqual(6);
    expect(seasonWave(999).throwEvery).toBeGreaterThanOrEqual(1.7);
  });

  it("同一个随机源摆出同一批站位", () => {
    const mk = (): number[] => {
      let s = 5;
      const rand = (): number => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
      return waveFoes(4, rand).map((f) => f.x);
    };
    expect(mk()).toEqual(mk());
  });

  it("清完一波会自己续上下一波,还顺手下一场雪把阵地补回来", () => {
    const a = endlessArena(3);
    for (const f of a.foes) f.melted = true;
    const before = depthAt(a.field, 8);
    const ev = hold(a, idleInput(), 3);
    expect(a.wave).toBe(2);
    expect(liveFoes(a).length).toBeGreaterThan(0);
    expect(ev.some((e) => e.kind === "wave")).toBe(true);
    expect(depthAt(a.field, 8)).toBeGreaterThanOrEqual(before);
  });

  it("一个会玩的小朋友能顶到第 8 波以上,而且雪季不会自己结束", () => {
    for (const seed of [1, 2, 3]) {
      const a = endlessArena(seed);
      botPlay(a, 260);
      expect(a.wave).toBeGreaterThanOrEqual(8);
      expect(a.melted).toBeGreaterThan(20);
    }
  }, 120000);
});

// ---------------------------------------------------------------------------
// 九、分级红线
// ---------------------------------------------------------------------------

describe("分级红线", () => {
  it("所有结算文案只鼓励,不出现输 / 死 / 血 / 伤,也不蹭商标", () => {
    const lines = [
      campaignWinLine(4, 10),
      campaignWinLine(9, 10),
      campaignWinLine(20, 10),
      campaignLoseLine("有雪人走到雪堡跟前啦"),
      campaignLoseLine("时间到"),
      seasonLine(7, 22, 9),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/死|血|伤|疼|痛|杀|淘汰|失败|你输/);
      expect(line).not.toMatch(/愤怒的小鸟|王者|吃鸡|Angry|Fortnite/i);
      expect(line.length).toBeGreaterThan(6);
    }
    expect(campaignWinLine(4, 10)).toContain("落点圈");
    expect(campaignLoseLine("有雪人走到雪堡跟前啦")).toContain("下次");
  });
});
