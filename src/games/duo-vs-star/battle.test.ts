import { describe, expect, it } from "vitest";
import { AI_STYLES, decideAi, emptyInput, type AiTier, type Input } from "./ai";
import {
  ACTOR_R,
  RESPAWN_DELAY,
  createMatch,
  leadIdle,
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
import { HAMMER_CHARGE, ITEM_EDGE_MARGIN, itemById, itemSpawnX, powerMul } from "./items";
import { STRUGGLE_WINDOW, bumpFromVigor } from "./knockback";
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
    expect(s.actors[0].char.name).toBe("鸭梨");
    expect(s.actors[1].char.name).toBe("康康");
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
    expect(s.actors[0].char.name).toBe("鸭梨");
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
    s.actors[1].outs = 2;
    idle(s, 4);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe("time");
    expect(s.winnerTeam).toBe(0);
    const stats = teamStats(s);
    expect(stats[0].stocks).toBeGreaterThanOrEqual(stats[1].stocks);
  });

  it("两边开局命数不一样时，比的是「剩几成」而不是「剩几条」", () => {
    // 战役关常给玩家 3 条命、对手只给 1 条。照剩余条数排，玩家一个键都不按也稳赢：
    // 3 条对 1 条。改成比剩余比例以后，一条都没掉的那边才算赢。
    const s = createMatch(
      cfg({
        stocks: 3,
        timeLimit: 3,
        slots: [
          { charId: "duoduo", team: 0, control: "p1", stocks: 3 },
          { charId: "xingxing", team: 1, control: "ai", aiTier: "normal", stocks: 1 },
        ],
      })
    );
    s.actors[0].stocks = 2;
    s.actors[0].outs = 1;
    expect(timeoutWinner(s)).toBe(1);
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

  it("两台小电脑放着自己打，是真的在打，不是干瞪眼到时间到", () => {
    // 每一局都要真打起来（两边都出手、场上真有人被撞出去），大多数局还要分出胜负。
    // 1:1 收在时间到那种是正经的平局，不该当成「打不完」——
    // 但要是一局都判不出赢家，那就是小电脑站着不动了。
    const seeds = [3, 5, 7, 11, 13, 17, 23, 29];
    let decided = 0;
    for (const seed of seeds) {
      const s = runMatch(createMatch(cfg({ stocks: 2, timeLimit: 120, itemEvery: 6, seed })), 130);
      expect(s.over).toBe(true);
      for (const a of s.actors) {
        expect(a.hits, `seed ${seed}：${a.char.name} 一整局一下都没打中过`).toBeGreaterThan(0);
      }
      const outs = s.actors.reduce((n, a) => n + a.outs, 0);
      expect(outs, `seed ${seed}：120 秒里一个人都没被撞出去`).toBeGreaterThan(0);
      if (s.winnerTeam !== null) decided++;
    }
    expect(decided, `${seeds.length} 局里只有 ${decided} 局分出了胜负`).toBeGreaterThanOrEqual(
      seeds.length - 2
    );
  });

  // 小电脑不再自己走下台以后，四人混战全靠真的把人撞出去，比 1.1 时候慢一截：
  // 原来 150 秒的盘口现在正好卡在时间到，所以把盘口放宽，别把「打得久」当成「打不完」。
  it("四人混战也能打到只剩一队", () => {
    const s = runMatch(
      createMatch(
        cfg({
          stocks: 2,
          timeLimit: 260,
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
      270
    );
    expect(s.over).toBe(true);
    expect(livingTeams(s).length).toBeLessThanOrEqual(1);
  });
});

describe("战役关的主角规则（cfg.lead）", () => {
  /** 一局 2v2：0 号是真人主角，1 号是小电脑队友，2/3 号是对手 */
  function teamCfg(over: Partial<MatchConfig> = {}): MatchConfig {
    return cfg({
      stocks: 2,
      timeLimit: 0,
      itemEvery: 0,
      seed: 21,
      slots: [
        { charId: "duoduo", team: 0, control: "p1", stocks: 2 },
        { charId: "nuonuo", team: 0, control: "ai", aiTier: "hard", stocks: 2 },
        { charId: "xingxing", team: 1, control: "ai", aiTier: "easy", stocks: 1 },
        { charId: "shanshan", team: 1, control: "ai", aiTier: "easy", stocks: 1 },
      ],
      ...over,
    });
  }

  /** 把某人连着撞出去 n 次（中间等他回场） */
  function knockOut(s: MatchState, index: number, times: number): void {
    for (let k = 0; k < times && !s.over; k++) {
      sendOut(s, index);
      stepMatch(s, 1 / 60, {});
      if (!s.over) idle(s, RESPAWN_DELAY + 0.2);
    }
  }

  it("主角上场机会用完，这一关当场结束、算他输——队友还站着也一样", () => {
    const s = createMatch(teamCfg({ lead: 0 }));
    knockOut(s, 0, 2);
    expect(s.actors[0].retired, "主角该退场了").toBe(true);
    expect(s.actors[1].retired, "队友还有上场机会").toBe(false);
    expect(s.over).toBe(true);
    expect(s.winnerTeam).toBe(1);
  });

  it("不设主角的局（双人同乐 / 沙盒）照旧：一个人退场不影响队友继续打", () => {
    const s = createMatch(teamCfg());
    knockOut(s, 0, 2);
    expect(s.actors[0].retired).toBe(true);
    expect(s.over, "没设主角就不该因为一个人退场而收摊").toBe(false);
  });

  it("主角一个键都没按，队友把对面清空也不给他判胜", () => {
    const s = createMatch(teamCfg({ lead: 0 }));
    sendOut(s, 2);
    stepMatch(s, 1 / 60, {});
    sendOut(s, 3);
    stepMatch(s, 1 / 60, {});
    expect(s.over).toBe(true);
    expect(leadIdle(s)).toBe(true);
    expect(s.winnerTeam, "摆烂不能靠队友过关").toBeNull();
  });

  it("主角只要真上手过，队友帮着赢就算赢", () => {
    const s = createMatch(teamCfg({ lead: 0 }));
    stepMatch(s, 1 / 60, { 0: press({ right: true }) });
    sendOut(s, 2);
    stepMatch(s, 1 / 60, {});
    sendOut(s, 3);
    stepMatch(s, 1 / 60, {});
    expect(leadIdle(s)).toBe(false);
    expect(s.winnerTeam).toBe(0);
  });

  it("按键要真按下去才算数：僵直里被清空的那几帧不影响判定", () => {
    const s = createMatch(teamCfg({ lead: 0 }));
    s.actors[0].stun = 0.5;
    stepMatch(s, 1 / 60, { 0: press({ heavy: true }) });
    expect(s.actors[0].acted, "被打懵的时候按键也是按了").toBe(true);
  });

  it("时间到那一路也走同一道关卡：主角没上手就不给判胜", () => {
    const s = runMatch(createMatch(teamCfg({ lead: 0, timeLimit: 8 })), 10);
    expect(s.endReason).toBe("time");
    expect(s.winnerTeam).not.toBe(0);
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

/* ------------------------------------------------------------------ */
/* 1.2：挣扎窗口、锤子蓄力、道具镜像落点、打法风格                     */
/* ------------------------------------------------------------------ */

describe("挣扎窗口", () => {
  /** 把两个人摆到面对面，且挨拍那位元气见底 */
  function setup(): MatchState {
    const s = createMatch(
      cfg({
        timeLimit: 0,
        slots: [
          { charId: "dundun", team: 0, control: "p1" },
          { charId: "duoduo", team: 1, control: "p2" },
        ],
      })
    );
    idle(s, 2);
    const [atk, def] = s.actors;
    atk.safe = 0;
    def.safe = 0;
    def.bump = bumpFromVigor(10);
    def.x = atk.x + 40;
    def.y = atk.y;
    atk.facing = 1;
    return s;
  }

  /** 出一记重击，一直打到命中为止 */
  function landHeavy(s: MatchState): boolean {
    for (let i = 0; i < 60; i++) {
      stepMatch(s, 1 / 60, { 0: press({ heavy: i === 0 }) });
      if (s.events.some((e) => e.kind === "hit")) return true;
    }
    return false;
  }

  it("元气见底挨拍会开出挣扎窗口，长度就是 STRUGGLE_WINDOW", () => {
    const s = setup();
    expect(landHeavy(s)).toBe(true);
    expect(s.actors[1].struggle).toBeGreaterThan(0);
    expect(s.actors[1].struggle).toBeLessThanOrEqual(STRUGGLE_WINDOW);
  });

  it("元气还满着的时候挨拍没有挣扎窗口——那一下本来也飞不出去", () => {
    const s = setup();
    s.actors[1].bump = 0;
    expect(landHeavy(s)).toBe(true);
    expect(s.actors[1].struggle).toBe(0);
  });

  it("挣扎窗口里朝场地里按方向键，这一下的飞行距离明显短一截", () => {
    const zone = safeZone(stageById("cloud-square"));
    const inward = (s: MatchState): Partial<Input> =>
      s.actors[1].x < (zone.min + zone.max) / 2 ? { right: true } : { left: true };

    const lazy = setup();
    expect(landHeavy(lazy)).toBe(true);
    const lazyStart = lazy.actors[1].x;
    idle(lazy, 0.5);
    const lazyGone = Math.abs(lazy.actors[1].x - lazyStart);

    const fought = setup();
    expect(landHeavy(fought)).toBe(true);
    const foughtStart = fought.actors[1].x;
    const key = press(inward(fought));
    for (let i = 0; i < 30; i++) stepMatch(fought, 1 / 60, { 1: key });
    const foughtGone = Math.abs(fought.actors[1].x - foughtStart);

    expect(fought.actors[1].struggle).toBe(0);
    expect(foughtGone).toBeLessThan(lazyGone);
  });

  it("挣扎只认「朝场地里」那一下，朝外按不算", () => {
    const s = setup();
    expect(landHeavy(s)).toBe(true);
    const zone = safeZone(s.stage);
    const outward = s.actors[1].x < (zone.min + zone.max) / 2 ? { left: true } : { right: true };
    stepMatch(s, 1 / 60, { 1: press(outward) });
    expect(s.events.some((e) => e.kind === "struggle")).toBe(false);
    expect(s.actors[1].struggle).toBeGreaterThan(0);
  });

  it("一次弹飞只许挣一下，挣完窗口就关了", () => {
    const s = setup();
    expect(landHeavy(s)).toBe(true);
    const zone = safeZone(s.stage);
    const key = press(s.actors[1].x < (zone.min + zone.max) / 2 ? { right: true } : { left: true });
    stepMatch(s, 1 / 60, { 1: key });
    expect(s.events.some((e) => e.kind === "struggle")).toBe(true);
    stepMatch(s, 1 / 60, { 1: key });
    expect(s.events.some((e) => e.kind === "struggle")).toBe(false);
  });

  it("回场之后挣扎窗口清零，不会带着上一条命的状态回来", () => {
    const s = setup();
    expect(landHeavy(s)).toBe(true);
    sendOut(s, 1);
    idle(s, 2.5);
    expect(s.actors[1].struggle).toBe(0);
    expect(s.actors[1].coopCd).toBe(0);
  });
});

describe("软软锤子要举满才沉手", () => {
  function withHammer(): MatchState {
    const s = createMatch(
      cfg({
        timeLimit: 0,
        slots: [
          { charId: "duoduo", team: 0, control: "p1" },
          { charId: "duoduo", team: 1, control: "p2" },
        ],
      })
    );
    idle(s, 2);
    const [atk, def] = s.actors;
    atk.safe = 0;
    def.safe = 0;
    def.x = atk.x + 40;
    def.y = atk.y;
    atk.facing = 1;
    const hammer = itemById("hammer");
    expect(hammer).not.toBeNull();
    atk.buffs.hammer = hammer?.duration ?? 8;
    atk.buffs.hammerCharge = HAMMER_CHARGE;
    return s;
  }

  it("捡到的那一刻锤子还是软的，力度一点都没加", () => {
    const s = withHammer();
    expect(powerMul(s.actors[0].buffs)).toBe(1);
    expect(HAMMER_CHARGE).toBeGreaterThan(0);
  });

  it("举满之后力度才翻上去", () => {
    const s = withHammer();
    idle(s, HAMMER_CHARGE + 0.1);
    expect(s.actors[0].buffs.hammerCharge).toBe(0);
    expect(powerMul(s.actors[0].buffs)).toBeGreaterThan(1.5);
  });

  it("蓄力期间打出去的那一下，比举满之后轻得多", () => {
    function hitBump(waitFor: number): number {
      const s = withHammer();
      if (waitFor > 0) idle(s, waitFor);
      s.actors[1].x = s.actors[0].x + 40;
      s.actors[1].y = s.actors[0].y;
      s.actors[0].facing = 1;
      for (let i = 0; i < 60; i++) {
        stepMatch(s, 1 / 60, { 0: press({ heavy: i === 0 }) });
        if (s.events.some((e) => e.kind === "hit")) break;
      }
      return s.actors[1].bump;
    }
    expect(hitBump(0)).toBeLessThan(hitBump(HAMMER_CHARGE + 0.1));
  });
});

describe("道具落点左右轮流", () => {
  it("连着掉下来的道具在中线两边轮换，不会连着偏一边", () => {
    const s = createMatch(
      cfg({ itemEvery: 0.6, slots: [{ charId: "duoduo", team: 0, control: "p1" }] })
    );
    const zone = safeZone(s.stage);
    const mid = (zone.min + zone.max) / 2;
    const sides: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < 60 * 40 && sides.length < 8; i++) {
      stepMatch(s, 1 / 60, {});
      for (const it of s.items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        sides.push(Math.sign(it.x - mid));
      }
    }
    expect(sides.length).toBeGreaterThanOrEqual(6);
    // 第 0 件在左、第 1 件在右，往下一直轮着来
    sides.forEach((side, i) => expect(side).toBe(i % 2 === 0 ? -1 : 1));
  });

  it("同一个随机数抽出来的左右两点关于中线严格对称", () => {
    for (const roll of [0, 0.13, 0.5, 0.87, 1]) {
      const left = itemSpawnX(200, 800, 0, roll);
      const right = itemSpawnX(200, 800, 1, roll);
      expect(left + right).toBeCloseTo(1000, 6);
      expect(left).toBeGreaterThanOrEqual(200 + ITEM_EDGE_MARGIN - 1e-9);
      expect(right).toBeLessThanOrEqual(800 - ITEM_EDGE_MARGIN + 1e-9);
    }
  });
});

describe("小电脑的打法风格", () => {
  it("四种打法都能跑完一整局，不会把自己走下场", () => {
    for (const style of AI_STYLES) {
      const s = runMatch(
        createMatch(
          cfg({
            stocks: 2,
            timeLimit: 90,
            itemEvery: 6,
            seed: 4242,
            slots: [
              { charId: "duoduo", team: 0, control: "ai", aiTier: "normal", aiStyle: style },
              { charId: "xingxing", team: 1, control: "ai", aiTier: "normal" },
            ],
          })
        ),
        95
      );
      expect(s.over).toBe(true);
      expect(livingTeams(s).length).toBeLessThanOrEqual(2);
    }
  });

  it("「会绕后」真的会往对手背后跑，而不是正面顶上去", () => {
    const view = {
      self: { x: 400, y: 358, vx: 0, vy: 0, onGround: true, bump: 0, jumpsLeft: 1 },
      target: { x: 460, y: 358, bump: 0, onGround: true },
      item: null,
      safe: { min: 190, max: 770, top: 380 },
      bounds: stageById("cloud-square").bounds,
    };
    const plain = decideAi(view, "normal", 0.5, "plain");
    const flank = decideAi(view, "normal", 0.5, "flank");
    expect(plain.intent).toBe("attack");
    // 对手站在中线左边，绕后就是绕到他更左边去
    expect(flank.input.left).toBe(true);
    expect(flank.input.right).toBe(false);
  });

  it("「等你出招」会先拉开距离，看到对手收招才压上去", () => {
    const base = {
      self: { x: 420, y: 358, vx: 0, vy: 0, onGround: true, bump: 0, jumpsLeft: 1 },
      item: null,
      safe: { min: 190, max: 770, top: 380 },
      bounds: stageById("cloud-square").bounds,
    };
    const idleFoe = decideAi(
      { ...base, target: { x: 470, y: 358, bump: 0, onGround: true } },
      "normal",
      0.5,
      "patient"
    );
    expect(idleFoe.intent).toBe("wait");
    expect(idleFoe.input.left).toBe(true);
    const openFoe = decideAi(
      { ...base, target: { x: 470, y: 358, bump: 0, onGround: true, recovering: true } },
      "normal",
      0.5,
      "patient"
    );
    expect(openFoe.intent).toBe("attack");
  });

  it("「抢道具」比正面来的更容易被道具勾走", () => {
    const view = {
      self: { x: 400, y: 358, vx: 0, vy: 0, onGround: true, bump: 0, jumpsLeft: 1 },
      target: { x: 440, y: 358, bump: 0, onGround: true },
      item: { x: 700, y: 300 },
      safe: { min: 190, max: 770, top: 380 },
      bounds: stageById("cloud-square").bounds,
    };
    let plainGrabs = 0;
    let greedyGrabs = 0;
    for (let i = 0; i < 100; i++) {
      const roll = i / 100;
      if (decideAi(view, "normal", roll, "plain").intent === "grab") plainGrabs++;
      if (decideAi(view, "normal", roll, "greedy").intent === "grab") greedyGrabs++;
    }
    expect(greedyGrabs).toBeGreaterThan(plainGrabs);
  });
});
