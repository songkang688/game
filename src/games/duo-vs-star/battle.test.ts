import { describe, expect, it } from "vitest";
import { emptyInput, type AiTier, type Input } from "./ai";
import {
  ACTOR_R,
  createMatch,
  livingTeams,
  makeRng,
  runMatch,
  safeZone,
  stepMatch,
  teamStats,
  timeoutWinner,
  type MatchConfig,
  type MatchState,
} from "./battle";
import { itemById } from "./items";
import { stageById } from "./stages";

function cfg(over: Partial<MatchConfig> = {}): MatchConfig {
  return {
    stageId: "cloud-square",
    slots: [
      { charId: "duoduo", team: 0, control: "ai", aiTier: "normal" },
      { charId: "xingxing", team: 1, control: "ai", aiTier: "normal" },
    ],
    stocks: 2,
    timeLimit: 0,
    itemEvery: 0,
    seed: 7,
    ...over,
  };
}

function press(over: Partial<Input>): Input {
  return { ...emptyInput(), ...over };
}

/** 直接把某人挪到弹飞线外面（模拟被撞出场外） */
function sendOut(s: MatchState, index: number): void {
  const a = s.actors[index];
  a.y = 5000;
  a.onGround = false;
  a.platIndex = -1;
}

/** 空跑若干秒（没人按键） */
function idle(s: MatchState, seconds: number, inputs: Record<number, Input> = {}): MatchState {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds / dt) && !s.over; i++) stepMatch(s, dt, inputs);
  return s;
}

describe("建局", () => {
  it("按槽位建出角色，每人拿到自己的上场机会", () => {
    const s = createMatch(cfg({ stocks: 3 }));
    expect(s.actors).toHaveLength(2);
    expect(s.actors[0].char.name).toBe("朵朵");
    expect(s.actors[1].char.name).toBe("星星");
    expect(s.actors.every((a) => a.stocks === 3)).toBe(true);
    expect(s.over).toBe(false);
  });

  it("槽位可以单独指定上场机会（守擂关用）", () => {
    const s = createMatch(
      cfg({
        stocks: 2,
        slots: [
          { charId: "duoduo", team: 0, control: "p1" },
          { charId: "dundun", team: 1, control: "ai", stocks: 5 },
        ],
      })
    );
    expect(s.actors[0].stocks).toBe(2);
    expect(s.actors[1].stocks).toBe(5);
  });

  it("找不到的场地 / 角色会退回默认，绝不崩", () => {
    const s = createMatch(cfg({ stageId: "不存在的场地", slots: [{ charId: "谁", team: 0, control: "p1" }] }));
    expect(s.stage.id).toBe("cloud-square");
    expect(s.actors[0].char.name).toBe("朵朵");
  });

  it("同一个种子跑出完全一样的一局", () => {
    const a = runMatch(createMatch(cfg({ itemEvery: 4 })), 120);
    const b = runMatch(createMatch(cfg({ itemEvery: 4 })), 120);
    expect(a.t).toBeCloseTo(b.t, 6);
    expect(a.winnerTeam).toBe(b.winnerTeam);
    expect(teamStats(a)).toEqual(teamStats(b));
  });

  it("带种子的随机数发生器输出稳定且落在 0..1", () => {
    const r1 = makeRng(123);
    const r2 = makeRng(123);
    for (let i = 0; i < 20; i++) {
      const v = r1();
      expect(v).toBe(r2());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("走位与场地机关", () => {
  it("按住方向键人就往那边走，松开就停", () => {
    const s = createMatch(cfg({ slots: [{ charId: "duoduo", team: 0, control: "p1" }, { charId: "xingxing", team: 1, control: "p2" }] }));
    idle(s, 1); // 先落地
    const x0 = s.actors[0].x;
    idle(s, 0.6, { 0: press({ right: true }) });
    expect(s.actors[0].x).toBeGreaterThan(x0);
    expect(s.actors[0].facing).toBe(1);
    const x1 = s.actors[0].x;
    idle(s, 0.4, { 0: press({ left: true }) });
    expect(s.actors[0].x).toBeLessThan(x1);
    expect(s.actors[0].facing).toBe(-1);
  });

  it("双人键位互不抢占：只给 1P 的操作不会让 2P 动", () => {
    const s = createMatch(
      cfg({ slots: [{ charId: "duoduo", team: 0, control: "p1" }, { charId: "xingxing", team: 1, control: "p2" }] })
    );
    idle(s, 1);
    const before = { x0: s.actors[0].x, x1: s.actors[1].x };
    idle(s, 0.6, { 0: press({ right: true }) });
    expect(Math.abs(s.actors[0].x - before.x0)).toBeGreaterThan(20);
    expect(Math.abs(s.actors[1].x - before.x1)).toBeLessThan(1);
    // 反过来只给 2P
    const mid = { x0: s.actors[0].x, x1: s.actors[1].x };
    idle(s, 0.6, { 1: press({ left: true }) });
    expect(Math.abs(s.actors[1].x - mid.x1)).toBeGreaterThan(20);
    expect(Math.abs(s.actors[0].x - mid.x0)).toBeLessThan(1);
  });

  it("会落到平台上站住，不会一直往下掉", () => {
    const s = createMatch(cfg({ slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    idle(s, 1.5);
    const a = s.actors[0];
    expect(a.onGround).toBe(true);
    expect(a.platIndex).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeCloseTo(400 - ACTOR_R, 3);
  });

  it("跳起来会离地，落回来还能再跳", () => {
    const s = createMatch(cfg({ slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    idle(s, 1.5);
    const groundY = s.actors[0].y;
    idle(s, 0.25, { 0: press({ up: true }) });
    expect(s.actors[0].onGround).toBe(false);
    expect(s.actors[0].y).toBeLessThan(groundY);
    idle(s, 2.5);
    expect(s.actors[0].onGround).toBe(true);
  });

  it("传送带会把站着不动的人往一边送", () => {
    const s = createMatch(cfg({ stageId: "belt-works", slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    idle(s, 1.2);
    const x0 = s.actors[0].x;
    idle(s, 1.2);
    expect(Math.abs(s.actors[0].x - x0)).toBeGreaterThan(30);
  });

  it("弹簧地会把落上去的人弹起来", () => {
    const s = createMatch(cfg({ stageId: "spring-candy", slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    let bounced = false;
    const dt = 1 / 60;
    for (let i = 0; i < 300 && !bounced; i++) {
      stepMatch(s, dt, {});
      if (s.actors[0].vy < -200) bounced = true;
    }
    expect(bounced).toBe(true);
  });

  it("在会塌的浮岛上站久了，浮岛真的会散开", () => {
    const s = createMatch(cfg({ stageId: "wobble-isles", slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    // 把人挪到会塌的那块岛上
    idle(s, 0.2);
    s.actors[0].x = 235;
    s.actors[0].y = 300;
    let collapsed = false;
    const dt = 1 / 60;
    for (let i = 0; i < 600 && !collapsed; i++) {
      stepMatch(s, dt, {});
      if (s.events.some((e) => e.kind === "collapse")) collapsed = true;
    }
    expect(collapsed).toBe(true);
    expect(s.plats.some((p) => p.hidden)).toBe(true);
  });

  it("咕嘟糖浆会一点点涨上来，碰到只是把人弹得高高的", () => {
    const s = createMatch(cfg({ stageId: "syrup-pool", slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    idle(s, 1.5);
    s.actors[0].x = 480;
    s.actors[0].y = 600;
    s.actors[0].onGround = false;
    s.actors[0].platIndex = -1;
    s.actors[0].safe = 0;
    let bumped = false;
    const dt = 1 / 60;
    for (let i = 0; i < 240 && !bumped; i++) {
      stepMatch(s, dt, {});
      if (s.events.some((e) => e.kind === "syrup")) bumped = true;
    }
    expect(bumped).toBe(true);
    expect(s.actors[0].vy).toBeLessThan(0);
    expect(s.actors[0].bump).toBeGreaterThan(0);
  });

  it("升降台带着站在上面的人一起走", () => {
    const s = createMatch(cfg({ stageId: "star-lift", slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    idle(s, 0.2);
    s.actors[0].x = 220;
    s.actors[0].y = 300;
    idle(s, 1.5);
    const a = s.actors[0];
    if (a.onGround && a.platIndex >= 0) {
      const st = s.plats[a.platIndex];
      expect(a.y).toBeCloseTo(st.y - ACTOR_R, 2);
    }
    expect(a.y).toBeLessThan(500);
  });

  it("主平台的安全区就是场地上最大的那块", () => {
    const zone = safeZone(stageById("cloud-square"));
    expect(zone.min).toBe(190);
    expect(zone.max).toBe(770);
    expect(zone.top).toBe(400);
  });
});

describe("挥击与击退", () => {
  function duo() {
    const s = createMatch(
      cfg({
        slots: [
          { charId: "duoduo", team: 0, control: "p1" },
          { charId: "xingxing", team: 1, control: "p2" },
        ],
      })
    );
    idle(s, 1.5);
    s.actors[0].x = 470;
    s.actors[1].x = 505;
    s.actors[0].safe = 0;
    s.actors[1].safe = 0;
    s.actors[0].facing = 1;
    return s;
  }

  it("挥击打中对手会涨击退值并把人推开", () => {
    const s = duo();
    const before = s.actors[1].x;
    idle(s, 0.35, { 0: press({ light: true }) });
    expect(s.actors[1].bump).toBeGreaterThan(0);
    expect(s.actors[1].x).toBeGreaterThan(before);
    expect(s.actors[1].onGround).toBe(false);
  });

  it("重击比轻击涨的击退值更多", () => {
    const light = duo();
    idle(light, 0.35, { 0: press({ light: true }) });
    const heavy = duo();
    idle(heavy, 0.75, { 0: press({ heavy: true }) });
    expect(heavy.actors[1].bump).toBeGreaterThan(light.actors[1].bump);
  });

  it("一次挥击对同一个人只算一下", () => {
    const s = duo();
    idle(s, 0.05, { 0: press({ light: true }) });
    const hits = s.events.filter((e) => e.kind === "hit").length;
    let more = 0;
    for (let i = 0; i < 20; i++) {
      stepMatch(s, 1 / 60, { 0: press({ light: true }) });
      more += s.events.filter((e) => e.kind === "hit").length;
    }
    expect(hits + more).toBeLessThanOrEqual(1);
  });

  it("刚回场的无敌时间里打不到人", () => {
    const s = duo();
    s.actors[1].safe = 1;
    idle(s, 0.35, { 0: press({ light: true }) });
    expect(s.actors[1].bump).toBe(0);
  });

  it("护盾泡泡会把这一下完全挡住，人不会被推开", () => {
    const s = duo();
    s.actors[1].shield = 100;
    const x = s.actors[1].x;
    idle(s, 0.35, { 0: press({ light: true }) });
    expect(s.actors[1].bump).toBe(0);
    expect(s.actors[1].x).toBeCloseTo(x, 1);
    expect(s.actors[1].shield).toBeLessThan(100);
    expect(s.events.length >= 0).toBe(true);
  });

  it("同队的人打不到彼此（组队赛不会误伤队友）", () => {
    const s = createMatch(
      cfg({
        slots: [
          { charId: "duoduo", team: 0, control: "p1" },
          { charId: "yunyun", team: 0, control: "p2" },
        ],
      })
    );
    idle(s, 1.5);
    s.actors[0].x = 470;
    s.actors[1].x = 505;
    s.actors[0].safe = 0;
    s.actors[1].safe = 0;
    s.actors[0].facing = 1;
    idle(s, 0.35, { 0: press({ light: true }) });
    expect(s.actors[1].bump).toBe(0);
  });

  it("击退值攒得越高，同一下被推得越远", () => {
    const calm = duo();
    idle(calm, 0.35, { 0: press({ light: true }) });
    const moved1 = calm.actors[1].x - 505;

    const wobbly = duo();
    wobbly.actors[1].bump = 260;
    idle(wobbly, 0.35, { 0: press({ light: true }) });
    const moved2 = wobbly.actors[1].x - 505;
    expect(moved2).toBeGreaterThan(moved1);
  });
});

describe("出界、上场机会与胜负", () => {
  it("被撞出弹飞线就少一次上场机会，过一会儿坐着小云朵回来", () => {
    const s = createMatch(
      cfg({ stocks: 3, slots: [{ charId: "duoduo", team: 0, control: "p1" }, { charId: "xingxing", team: 1, control: "p2" }] })
    );
    idle(s, 1);
    sendOut(s, 1);
    stepMatch(s, 1 / 60, {});
    expect(s.actors[1].stocks).toBe(2);
    expect(s.actors[1].outs).toBe(1);
    expect(s.actors[1].onStage).toBe(false);
    expect(s.events.some((e) => e.kind === "ko")).toBe(true);
    idle(s, 2);
    expect(s.actors[1].onStage).toBe(true);
    expect(s.actors[1].bump).toBe(0);
    expect(s.actors[1].safe).toBeGreaterThan(0);
  });

  it("上场机会用完就到场边休息，比赛随即分出胜负", () => {
    const s = createMatch(
      cfg({ stocks: 1, slots: [{ charId: "duoduo", team: 0, control: "p1" }, { charId: "xingxing", team: 1, control: "p2" }] })
    );
    idle(s, 1);
    sendOut(s, 1);
    stepMatch(s, 1 / 60, {});
    expect(s.actors[1].retired).toBe(true);
    expect(s.over).toBe(true);
    expect(s.winnerTeam).toBe(0);
    expect(s.endReason).toBe("ko");
    expect(livingTeams(s)).toEqual([0]);
  });

  it("撞出去的功劳记在最后打中的人头上", () => {
    const s = createMatch(
      cfg({ stocks: 2, slots: [{ charId: "duoduo", team: 0, control: "p1" }, { charId: "jiujiu", team: 1, control: "p2" }] })
    );
    idle(s, 1.5);
    s.actors[0].x = 470;
    s.actors[1].x = 505;
    s.actors[0].safe = 0;
    s.actors[1].safe = 0;
    s.actors[1].bump = 300;
    idle(s, 0.75, { 0: press({ heavy: true }) });
    idle(s, 2.5);
    expect(s.actors[1].outs).toBeGreaterThanOrEqual(1);
    expect(s.actors[0].kos).toBeGreaterThanOrEqual(1);
  });

  it("自己走下去掉出场外不算给对手记功", () => {
    const s = createMatch(
      cfg({ stocks: 2, slots: [{ charId: "duoduo", team: 0, control: "p1" }, { charId: "xingxing", team: 1, control: "p2" }] })
    );
    idle(s, 1);
    sendOut(s, 1);
    stepMatch(s, 1 / 60, {});
    expect(s.actors[0].kos).toBe(0);
    expect(s.actors[1].outs).toBe(1);
  });

  it("2v2 团队赛：一整队休息完了才算输", () => {
    const s = createMatch(
      cfg({
        stocks: 1,
        slots: [
          { charId: "duoduo", team: 0, control: "p1" },
          { charId: "yunyun", team: 0, control: "ai" },
          { charId: "xingxing", team: 1, control: "ai" },
          { charId: "dundun", team: 1, control: "ai" },
        ],
      })
    );
    idle(s, 1);
    sendOut(s, 2);
    stepMatch(s, 1 / 60, {});
    expect(s.over).toBe(false); // 蓝队还有一个人
    sendOut(s, 3);
    stepMatch(s, 1 / 60, {});
    expect(s.over).toBe(true);
    expect(s.winnerTeam).toBe(0);
  });

  it("时间到就按「剩余上场机会 → 撞飞数 → 被撞飞数」排名", () => {
    const s = createMatch(cfg({ stocks: 3, timeLimit: 3 }));
    s.actors[1].stocks = 1;
    idle(s, 4);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe("time");
    expect(s.winnerTeam).toBe(0);
    const stats = teamStats(s);
    expect(stats[0].stocks).toBeGreaterThanOrEqual(stats[1].stocks);
  });

  it("时间到时各项完全打平就是平局", () => {
    const s = createMatch(cfg({ stocks: 2, timeLimit: 1 }));
    expect(timeoutWinner(s)).toBeNull();
  });

  it("比赛结束后再推进也不会改变结果", () => {
    const s = runMatch(createMatch(cfg({ stocks: 1, timeLimit: 20 })), 30);
    const snapshot = { t: s.t, winner: s.winnerTeam, reason: s.endReason };
    stepMatch(s, 1 / 60, {});
    stepMatch(s, 1 / 60, {});
    expect(s.t).toBeCloseTo(snapshot.t, 6);
    expect(s.winnerTeam).toBe(snapshot.winner);
    expect(s.endReason).toBe(snapshot.reason);
  });

  it("两台小电脑放着自己打，一定能打到真实胜负", () => {
    for (const seed of [3, 11, 29]) {
      const s = runMatch(createMatch(cfg({ stocks: 2, timeLimit: 120, itemEvery: 6, seed })), 130);
      expect(s.over).toBe(true);
      expect(s.winnerTeam === 0 || s.winnerTeam === 1).toBe(true);
    }
  });

  it("四人混战也能打到只剩一队", () => {
    const s = runMatch(
      createMatch(
        cfg({
          stocks: 2,
          timeLimit: 150,
          itemEvery: 5,
          seed: 5,
          slots: [
            { charId: "duoduo", team: 0, control: "ai", aiTier: "normal" },
            { charId: "xingxing", team: 1, control: "ai", aiTier: "normal" },
            { charId: "nuonuo", team: 2, control: "ai", aiTier: "easy" },
            { charId: "shanshan", team: 3, control: "ai", aiTier: "easy" },
          ],
        })
      ),
      160
    );
    expect(s.over).toBe(true);
    expect(livingTeams(s).length).toBeLessThanOrEqual(1);
  });
});

describe("道具", () => {
  function withItem(id: string) {
    const s = createMatch(cfg({ itemEvery: 0, slots: [{ charId: "duoduo", team: 0, control: "p1" }, { charId: "xingxing", team: 1, control: "p2" }] }));
    idle(s, 1.5);
    const def = itemById(id);
    expect(def).not.toBeNull();
    s.items.push({ id: 1, def: def!, x: s.actors[0].x, y: s.actors[0].y, vy: 0, landed: true, life: 0 });
    stepMatch(s, 1 / 60, {});
    return s;
  }

  it("碰到道具就立刻生效，并且道具从场上消失", () => {
    const s = withItem("hammer");
    expect(s.items).toHaveLength(0);
    expect(s.actors[0].buffs.hammer).toBeGreaterThan(0);
    expect(s.actors[0].lastItem).toBe("软软锤子");
  });

  it("护盾泡泡把耐久加满", () => {
    expect(withItem("shield").actors[0].shield).toBe(100);
  });

  it("蜂蜜罐只黏别人，不黏自己", () => {
    const s = withItem("honey");
    expect(s.actors[0].buffs.slow).toBe(0);
    expect(s.actors[1].buffs.slow).toBeGreaterThan(0);
  });

  it("冰淇淋让最近的对手原地打转", () => {
    const s = withItem("icecream");
    expect(s.actors[1].buffs.dizzy).toBeGreaterThan(0);
  });

  it("叮叮铃把自己的击退值直接减一半", () => {
    const s = createMatch(cfg({ itemEvery: 0, slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    idle(s, 1.5);
    s.actors[0].bump = 200;
    s.items.push({ id: 1, def: itemById("bell")!, x: s.actors[0].x, y: s.actors[0].y, vy: 0, landed: true, life: 0 });
    stepMatch(s, 1 / 60, {});
    expect(s.actors[0].bump).toBeCloseTo(100, 1);
  });

  it("彩虹翅膀把人送回场地正上方", () => {
    const s = createMatch(cfg({ itemEvery: 0, slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    idle(s, 1.5);
    s.actors[0].x = 900;
    s.items.push({ id: 1, def: itemById("rainbow")!, x: 900, y: s.actors[0].y, vy: 0, landed: true, life: 0 });
    stepMatch(s, 1 / 60, {});
    expect(s.actors[0].x).toBeCloseTo(480, 0);
    expect(s.actors[0].y).toBeLessThan(400);
  });

  it("咚咚鼓把站在地上的对手震得跳起来", () => {
    const s = withItem("drum");
    expect(s.actors[1].vy).toBeLessThan(0);
    expect(s.actors[1].onGround).toBe(false);
  });

  it("开了道具的场次会自己掉道具下来", () => {
    const s = createMatch(cfg({ itemEvery: 2, slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    let spawned = false;
    const dt = 1 / 60;
    for (let i = 0; i < 300 && !spawned; i++) {
      stepMatch(s, dt, {});
      if (s.items.length > 0 || s.events.some((e) => e.kind === "item")) spawned = true;
    }
    expect(spawned).toBe(true);
  });

  it("itemEvery 为 0 的场次一整场都不会掉道具", () => {
    const s = createMatch(cfg({ itemEvery: 0, slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    idle(s, 30);
    expect(s.items).toHaveLength(0);
  });

  it("限定道具池的场次只会掉池子里的东西", () => {
    const s = createMatch(cfg({ itemEvery: 1, itemPool: ["shield"], slots: [{ charId: "duoduo", team: 0, control: "p1" }] }));
    const seen = new Set<string>();
    const dt = 1 / 60;
    for (let i = 0; i < 1800; i++) {
      stepMatch(s, dt, {});
      for (const it of s.items) seen.add(it.def.id);
    }
    expect(seen.size).toBeGreaterThan(0);
    expect(Array.from(seen)).toEqual(["shield"]);
  });
});

describe("小电脑三档", () => {
  function duel(a: AiTier, b: AiTier, seeds: number): number {
    let wins = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const s = runMatch(
        createMatch(
          cfg({
            stocks: 2,
            timeLimit: 100,
            itemEvery: 6,
            seed,
            slots: [
              { charId: "duoduo", team: 0, control: "ai", aiTier: a },
              { charId: "duoduo", team: 1, control: "ai", aiTier: b },
            ],
          })
        ),
        110
      );
      if (s.winnerTeam === 0) wins++;
    }
    return wins;
  }

  it("高手档明显打得过轻松档", () => {
    const wins = duel("hard", "easy", 20);
    expect(wins).toBeGreaterThan(12);
  });

  it("正常档也稳稳压过轻松档", () => {
    expect(duel("normal", "easy", 20)).toBeGreaterThan(11);
  });

  it("高手档对正常档同样占优", () => {
    expect(duel("hard", "normal", 20)).toBeGreaterThan(10);
  });

  it("同档对同档大致五五开，不会一边倒", () => {
    const wins = duel("normal", "normal", 20);
    expect(wins).toBeGreaterThan(3);
    expect(wins).toBeLessThan(17);
  });
});
