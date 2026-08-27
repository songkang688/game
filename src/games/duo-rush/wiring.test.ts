/**
 * 1.2 第 11 步 A · 接线层单测。
 *
 * `rush12.test.ts` 管的是纯逻辑（道具状态机、分岔公平性、让分公式、关号映射）；
 * 这一份管的是**它们有没有真的接进比赛里**：道具捡得到用得出去、护盾真的挡了一下、
 * 磁力星真的把邻道金币吸过来、分岔真的按车道分路又在同一米合流、
 * 新键位与触屏按钮各归各人、领先皇冠与让分标注取数正确。
 *
 * 红线复查也放在这里：1.1 的老赛道一个字节都不许变，AI 不许有速度外挂。
 */
import { describe, expect, it } from "vitest";
import { AI_LEVELS, AI_SPEED_MULT } from "./ai";
import {
  P1_EXTRA_KEYS,
  P1_KEYS,
  P2_EXTRA_KEYS,
  P2_KEYS,
  TOUCH_MIN_PX,
  fullKeyMap,
  isWatchedKey,
  padRects,
  resolveKey,
} from "./keys";
import { GHOST_KEY, RACE_MODES, createTrackGen, isObstacle } from "./logic";
import {
  CROWN_MIN_GAP,
  type MatchEvent,
  type MatchState,
  applyAction,
  branchForLane,
  createMatch,
  drainEvents,
  entitiesFor,
  forkSpanBetween,
  leaderSeat,
  magnetPulls,
  stepMatch,
} from "./match";
import { meta } from "./meta";
import {
  FORK_LENGTH,
  FORK_MIN_SPACING,
  GHOST_RIVAL_KEY,
  HANDICAP_MAX,
  POWERUP_KINDS,
  levelFromQuery,
} from "./rush12";
import { LANE_TWEEN_SECONDS, bumpShake, crownOffset, laneTiltDeg } from "./view25d";

/** 跑 seconds 秒，把这段时间里攒下的事件全收回来 */
function runCollect(state: MatchState, seconds: number, dt = 1 / 60): MatchEvent[] {
  const out: MatchEvent[] = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps && !state.over; i++) {
    stepMatch(state, dt);
    out.push(...drainEvents(state));
  }
  return out;
}

function run(state: MatchState, seconds: number, dt = 1 / 60): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps && !state.over; i++) stepMatch(state, dt);
}

describe("1.1 老赛道一个字节都没变", () => {
  it("不传选项、传标准难度档,生成出来的实体表逐个字段一致", () => {
    for (const seed of [1, 4242, 20260826]) {
      const old = createTrackGen(seed).ensure(3000);
      const std = createTrackGen(seed, { difficulty: 1 }).ensure(3000);
      expect(std).toEqual(old);
    }
  });

  it("不开道具时赛道上一件道具都没有,老赛制照旧", () => {
    const track = createTrackGen(99, { difficulty: 1 }).ensure(3000);
    expect(track.some((e) => e.kind === "power")).toBe(false);
    const state = createMatch({ mode: "rush", seed: 99 });
    expect(state.usePowerups).toBe(false);
    expect(state.useForks).toBe(false);
    expect(state.handicap).toBe(false);
  });

  it("难度档只动段间空隙:档位越高同一段路里的东西越多", () => {
    const count = (difficulty: 0 | 1 | 2 | 3): number =>
      createTrackGen(777, { difficulty }).ensure(4000).length;
    expect(count(0)).toBeLessThan(count(1));
    expect(count(1)).toBeLessThan(count(2));
    expect(count(2)).toBeLessThan(count(3));
  });
});

describe("道具接进比赛了", () => {
  it("道具竞速默认就撒道具、开分岔,其余赛制默认都不开", () => {
    const items = createMatch({ mode: "items", seed: 5 });
    expect(items.usePowerups).toBe(true);
    expect(items.useForks).toBe(true);
    for (const mode of ["rush", "ghost", "endless", "coins"] as const) {
      const s = createMatch({ mode, seed: 5 });
      expect(s.usePowerups).toBe(false);
      expect(s.useForks).toBe(false);
    }
    expect(RACE_MODES).toContain("items");
  });

  it("赛道上撒的是四种道具里的,而且不算障碍", () => {
    const track = createTrackGen(31, { powerups: POWERUP_KINDS }).ensure(4000);
    const powers = track.filter((e) => e.kind === "power");
    expect(powers.length).toBeGreaterThan(3);
    for (const p of powers) {
      expect(POWERUP_KINDS).toContain(p.power);
      expect(isObstacle(p.kind)).toBe(false);
    }
  });

  it("跑过道具是先揣进手里,不会自己生效", () => {
    const state = createMatch({ mode: "items", seed: 88 });
    const events = runCollect(state, 30);
    expect(events).toContain("power");
    const r = state.runners[0];
    // 揣着的那件还在手上,身上没有任何效果自己冒出来
    expect(r.held === null || POWERUP_KINDS.includes(r.held)).toBe(true);
    expect(r.powers.speedCloud).toBe(0);
    expect(r.powers.magnetStar).toBe(0);
  });

  it("空手按用道具什么都不发生,按下去才算数", () => {
    const state = createMatch({ mode: "items", seed: 12 });
    drainEvents(state);
    expect(applyAction(state, 0, "use")).toBe(false);
    expect(drainEvents(state)).toEqual([]);
    state.runners[0].held = "speedCloud";
    expect(applyAction(state, 0, "use")).toBe(true);
    expect(state.runners[0].held).toBeNull();
    expect(state.runners[0].powers.speedCloud).toBeGreaterThan(0);
  });

  it("加速云用出去真的跑得更远(和同种子不用的一局比)", () => {
    const plain = createMatch({ mode: "items", seed: 606 });
    const fast = createMatch({ mode: "items", seed: 606 });
    fast.runners[0].held = "speedCloud";
    applyAction(fast, 0, "use");
    run(plain, 2);
    run(fast, 2);
    expect(fast.runners[0].dist).toBeGreaterThan(plain.runners[0].dist);
  });

  it("减速彩纸只落在对手身上,而且不掉心、不出局", () => {
    const state = createMatch({ mode: "items", seed: 77 });
    state.runners[0].held = "confetti";
    drainEvents(state);
    expect(applyAction(state, 0, "use")).toBe(true);
    expect(drainEvents(state)).toEqual(["use", "confetti"]);
    expect(state.runners[0].powers.confetti).toBe(0); // 自己一点事没有
    expect(state.runners[1].powers.confetti).toBeGreaterThan(0);
    expect(state.runners[1].crashes).toBe(0);
    expect(state.runners[1].hearts).toBe(3);
    expect(state.runners[1].out).toBe(false);
  });

  it("护盾泡替你挡了一下:那一下不算撞车", () => {
    const bare = createMatch({ mode: "rush", seed: 424242 });
    const safe = createMatch({ mode: "rush", seed: 424242 });
    safe.runners[0].powers = { ...safe.runners[0].powers, shield: 1 };
    const events = runCollect(safe, 30);
    run(bare, 30);
    expect(events).toContain("shield");
    expect(safe.runners[0].crashes).toBeLessThan(bare.runners[0].crashes);
    expect(safe.runners[0].powers.shield).toBe(0); // 挡完泡泡就破了
  });

  it("磁力星把邻道的金币吸过来,不开就吸不到", () => {
    const plain = createMatch({ mode: "rush", seed: 20260826 });
    const magnet = createMatch({ mode: "rush", seed: 20260826 });
    magnet.runners[0].powers = { ...magnet.runners[0].powers, magnetStar: 999 };
    run(plain, 25);
    run(magnet, 25);
    expect(magnet.runners[0].coins).toBeGreaterThan(plain.runners[0].coins);
    expect(magnetPulls(magnet.runners[0], 1)).toBe(true);
    expect(magnetPulls(magnet.runners[0], 2)).toBe(false); // 只吸隔壁一条道
    expect(magnetPulls(plain.runners[0], 1)).toBe(false);
  });

  it("加油键是纯打气:成绩一个数都不动", () => {
    const state = createMatch({ mode: "items", seed: 9 });
    run(state, 3);
    const before = { ...state.runners[0] };
    drainEvents(state);
    expect(applyAction(state, 0, "cheer")).toBe(true);
    expect(drainEvents(state)).toEqual(["cheer"]);
    expect(state.runners[0].dist).toBe(before.dist);
    expect(state.runners[0].coins).toBe(before.coins);
    expect(state.runners[0].crashes).toBe(before.crashes);
    expect(state.runners[0].cheerUntil).toBeGreaterThan(state.time);
  });
});

describe("中途分岔接进比赛了", () => {
  it("开了分岔以后,主赛道在分岔段整段留白", () => {
    const track = createTrackGen(2026, { holeAt: forkSpanBetween }).ensure(2000);
    for (let k = 1; k * FORK_MIN_SPACING <= 2000; k++) {
      const start = k * FORK_MIN_SPACING;
      const inside = track.filter((e) => e.at >= start && e.at < start + FORK_LENGTH);
      expect(inside, `第 ${k} 个分岔段没留白`).toEqual([]);
    }
  });

  it("不开分岔时那一段照旧铺满(老赛道不受影响)", () => {
    const track = createTrackGen(2026).ensure(2000);
    const inside = track.filter(
      (e) => e.at >= FORK_MIN_SPACING && e.at < FORK_MIN_SPACING + FORK_LENGTH,
    );
    expect(inside.length).toBeGreaterThan(0);
  });

  it("站右道走右边那条,左道和中道走左边那条", () => {
    expect(branchForLane(2)).toBe(1);
    expect(branchForLane(1)).toBe(0);
    expect(branchForLane(0)).toBe(0);
  });

  it("跑进分岔口会选一条支路,越过合流点回主赛道", () => {
    const state = createMatch({ mode: "items", seed: 4 });
    const events: MatchEvent[] = [];
    let branchSeen: 0 | 1 | null = null;
    for (let i = 0; i < 60 * 60 && !state.over; i++) {
      stepMatch(state, 1 / 60);
      events.push(...drainEvents(state));
      if (state.runners[0].branch !== null) branchSeen = state.runners[0].branch;
      if (events.includes("merge")) break;
    }
    expect(events).toContain("fork");
    expect(events).toContain("merge");
    expect(branchSeen === 0 || branchSeen === 1).toBe(true);
    expect(state.runners[0].branch).toBeNull(); // 合流之后回到主赛道
  });

  it("两个人各走一条支路,回到主赛道的那一米完全一样", () => {
    const state = createMatch({ mode: "items", seed: 4 });
    applyAction(state, 1, "right"); // 星星贴右道,朵朵留中道
    applyAction(state, 1, "right");
    let mergeAt = 0;
    for (let i = 0; i < 60 * 60 && !state.over; i++) {
      stepMatch(state, 1 / 60);
      drainEvents(state);
      const [a, b] = state.runners;
      if (a.branch !== null && b.branch !== null) {
        expect(a.branchAt).toBe(b.branchAt); // 同一个分岔口
        expect(a.branch).not.toBe(b.branch); // 走的却是两条路
        mergeAt = a.branchAt + FORK_LENGTH;
      }
      if (mergeAt > 0 && a.dist > mergeAt && b.dist > mergeAt) break;
    }
    expect(mergeAt).toBeGreaterThan(0);
    expect(state.runners[0].branch).toBeNull();
    expect(state.runners[1].branch).toBeNull();
  });

  it("在支路上时,画面与电脑看到的是支路那份实体表", () => {
    const state = createMatch({ mode: "items", seed: 4 });
    for (let i = 0; i < 60 * 60 && state.runners[0].branch === null && !state.over; i++) {
      stepMatch(state, 1 / 60);
    }
    expect(state.runners[0].branch).not.toBeNull();
    const view = entitiesFor(state, 0);
    const fork = state.forks.find((f) => f.at === state.runners[0].branchAt);
    expect(fork).toBeTruthy();
    expect(view.entities).toBe(fork?.branches[state.runners[0].branch ?? 0].entities);
  });
});

describe("让分与领先反馈", () => {
  it("让分默认关,开了才写进对局", () => {
    expect(createMatch({ mode: "rush", seed: 1 }).handicap).toBe(false);
    expect(createMatch({ mode: "rush", seed: 1, handicap: true }).handicap).toBe(true);
  });

  it("开了让分,落后的一方确实追得快一点点", () => {
    const fair = createMatch({ mode: "rush", seed: 15 });
    const kind = createMatch({ mode: "rush", seed: 15, handicap: true });
    for (const s of [fair, kind]) {
      s.runners[1].dist = 400; // 星星先跑出去一大截
      run(s, 6);
    }
    const gapFair = fair.runners[1].dist - fair.runners[0].dist;
    const gapKind = kind.runners[1].dist - kind.runners[0].dist;
    expect(gapKind).toBeLessThan(gapFair);
  });

  it("助推封顶 8%:哪怕落后一整条赛道,一帧也只多跑这么多", () => {
    const fair = createMatch({ mode: "rush", seed: 15 });
    const kind = createMatch({ mode: "rush", seed: 15, handicap: true });
    for (const s of [fair, kind]) s.runners[1].dist = 5000; // 差得再离谱也就这样
    const fairFrom = fair.runners[0].dist;
    const kindFrom = kind.runners[0].dist;
    stepMatch(fair, 1 / 60);
    stepMatch(kind, 1 / 60);
    const fairStep = fair.runners[0].dist - fairFrom;
    const kindStep = kind.runners[0].dist - kindFrom;
    expect(kindStep).toBeGreaterThan(fairStep);
    // 速度曲线本身随里程微微上扬，一帧里多跑的那点也会带上一丁点，留 0.1% 余量
    expect(kindStep / fairStep).toBeLessThan(1 + HANDICAP_MAX + 0.001);
  });

  it("让分只帮落后的一方,领先的一方一点便宜都占不到", () => {
    const fair = createMatch({ mode: "rush", seed: 15 });
    const kind = createMatch({ mode: "rush", seed: 15, handicap: true });
    for (const s of [fair, kind]) s.runners[0].dist = 5000; // 这回是朵朵领先
    const fairFrom = fair.runners[0].dist;
    const kindFrom = kind.runners[0].dist;
    stepMatch(fair, 1 / 60);
    stepMatch(kind, 1 / 60);
    expect(kind.runners[0].dist - kindFrom).toBeCloseTo(fair.runners[0].dist - fairFrom, 10);
  });

  it("小皇冠只给领先的一方,差得少就算持平", () => {
    const state = createMatch({ mode: "rush", seed: 3 });
    expect(leaderSeat(state)).toBe(-1);
    state.runners[0].dist = CROWN_MIN_GAP + 20;
    expect(leaderSeat(state)).toBe(0);
    state.runners[1].dist = CROWN_MIN_GAP + 60;
    expect(leaderSeat(state)).toBe(1);
    state.runners[1].dist = state.runners[0].dist + 1;
    expect(leaderSeat(state)).toBe(-1);
  });

  it("抢金币赛的领先按金币算", () => {
    const state = createMatch({ mode: "coins", seed: 3 });
    state.runners[0].dist = 900;
    state.runners[1].coins = 5;
    expect(leaderSeat(state)).toBe(1);
  });
});

describe("幽灵来源与存档 key", () => {
  it("对手影子和自己影子分别叫什么、长什么样", () => {
    const self = createMatch({ mode: "ghost", seed: 6, ghostSource: "self" });
    const rival = createMatch({ mode: "ghost", seed: 6, ghostSource: "rival" });
    expect(self.ghostSource).toBe("self");
    expect(self.runners[1].name).toContain("自己");
    expect(rival.ghostSource).toBe("rival");
    expect(rival.runners[1].name).toContain("对手");
    expect(rival.runners[1].ghost).toBe(true);
  });

  it("两把存档 key 各存各的,前缀照旧,只增不改", () => {
    expect(GHOST_RIVAL_KEY).not.toBe(GHOST_KEY);
    expect(GHOST_RIVAL_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(GHOST_KEY).toBe("yiduo-yixing.duo-rush.ghost.v1");
  });
});

describe("1.2 键位与触屏控件", () => {
  it("朵朵多了 F/G,星星多了 L/K,四张表两两零交集", () => {
    expect(Object.keys(P1_EXTRA_KEYS).sort()).toEqual(["KeyF", "KeyG"]);
    expect(Object.keys(P2_EXTRA_KEYS).sort()).toEqual(["KeyK", "KeyL"]);
    const all = [
      ...Object.keys(P1_KEYS),
      ...Object.keys(P2_KEYS),
      ...Object.keys(P1_EXTRA_KEYS),
      ...Object.keys(P2_EXTRA_KEYS),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it("新键认得出是谁的、要干什么,而且归游戏管", () => {
    expect(resolveKey("KeyF")).toEqual({ seat: 0, action: "use" });
    expect(resolveKey("KeyG")).toEqual({ seat: 0, action: "cheer" });
    expect(resolveKey("KeyL")).toEqual({ seat: 1, action: "use" });
    expect(resolveKey("KeyK")).toEqual({ seat: 1, action: "cheer" });
    for (const code of ["KeyF", "KeyG", "KeyL", "KeyK"]) {
      expect(isWatchedKey(code)).toBe(true);
    }
    expect(Object.keys(fullKeyMap(0))).toHaveLength(6);
    expect(Object.keys(fullKeyMap(1))).toHaveLength(6);
  });

  it("360px 上下分屏:两颗按钮都 ≥44px、不重叠、不越到对方半屏", () => {
    const size = { width: 360, height: 416 };
    for (const seat of [0, 1] as const) {
      const [a, b] = padRects(size, "column", seat);
      for (const r of [a, b]) {
        expect(r.width).toBeGreaterThanOrEqual(TOUCH_MIN_PX);
        expect(r.height).toBeGreaterThanOrEqual(TOUCH_MIN_PX);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(size.width);
        const top = seat === 0 ? 0 : size.height / 2;
        expect(r.y).toBeGreaterThanOrEqual(top);
        expect(r.y + r.height).toBeLessThanOrEqual(top + size.height / 2);
      }
      expect(a.x + a.width).toBeLessThanOrEqual(b.x); // 两颗之间留着空隙
    }
    // 上半屏那两颗和下半屏那两颗也不会撞在一起
    const up = padRects(size, "column", 0)[0];
    const down = padRects(size, "column", 1)[0];
    expect(up.y + up.height).toBeLessThanOrEqual(down.y);
  });

  it("左右分屏时两个人的按钮各在自己那半边", () => {
    const size = { width: 900, height: 320 };
    const [a] = padRects(size, "row", 0);
    const [b] = padRects(size, "row", 1);
    expect(a.x + a.width).toBeLessThanOrEqual(size.width / 2);
    expect(b.x).toBeGreaterThanOrEqual(size.width / 2);
  });
});

describe("换道手感与 reduced-motion", () => {
  it("换道插值落在 80–120ms 这个区间里", () => {
    expect(LANE_TWEEN_SECONDS).toBeGreaterThanOrEqual(0.08);
    expect(LANE_TWEEN_SECONDS).toBeLessThanOrEqual(0.12);
  });

  it("横移时会轻轻侧倾,方向跟着走", () => {
    expect(laneTiltDeg(2, 1.4)).toBeGreaterThan(0);
    expect(laneTiltDeg(0, 0.6)).toBeLessThan(0);
    expect(laneTiltDeg(1, 1)).toBe(0);
  });

  it("prefers-reduced-motion 下侧倾与打晃归零,位移照旧", () => {
    expect(laneTiltDeg(2, 1.4, true)).toBe(0);
    expect(bumpShake(1, 3.2, 40, true)).toBe(0);
    expect(Math.abs(bumpShake(1, 3.2, 40, false))).toBeGreaterThan(0);
    expect(crownOffset(40)).toBeGreaterThan(0);
  });
});

describe("平台接线与红线", () => {
  it("电脑四档都没有速度外挂", () => {
    expect(AI_LEVELS).toHaveLength(4);
    for (const level of AI_LEVELS) expect(AI_SPEED_MULT[level]).toBe(1);
  });

  it("?level=N 取得出关号,取不到就按默认档", () => {
    expect(levelFromQuery("?level=100")).toBe(100);
    expect(levelFromQuery("id=duo-rush&level=7")).toBe(7);
    expect(levelFromQuery("?level=abc")).toBeNull();
    expect(levelFromQuery("?other=1")).toBeNull();
    expect(levelFromQuery("")).toBeNull();
    expect(levelFromQuery(null)).toBeNull();
  });

  it("meta 填的和实现对得上:有对战/无尽/双人,没有闯关", () => {
    expect(meta.modes).toEqual(["versus", "endless", "twoPlayer"]);
    expect(meta.modes).not.toContain("campaign");
    expect((meta as { levels?: number }).levels).toBeUndefined();
    expect(meta.platform).toBe("both");
  });

  it("道具竞速沿用「先撞满三次的人输」这条规矩", () => {
    const state = createMatch({ mode: "items", seed: 31, aiLevel: 3 });
    run(state, 200);
    expect(state.over).toBe(true);
    expect(state.runners[0].out).toBe(true);
    expect(state.winner).toBe(1);
  });
});
