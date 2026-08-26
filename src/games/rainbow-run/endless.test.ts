import { describe, expect, it } from "vitest";
import {
  CHASER_COIN_BONUS,
  CHASER_DODGE_BONUS,
  CHASER_HIT_PENALTY,
  CHASER_MAX_GAP,
  CHASER_NAME,
  CHASER_RAIL_BONUS,
  CHASER_START_GAP,
  CHASER_WARN_GAP,
  ENDLESS_TIERS,
  FAIR_WINDOW_ROWS,
  SEGMENT_TEMPLATES,
  buildSegment,
  buildSegmentWith,
  chaserBoost,
  chaserCaught,
  chaserDrift,
  chaserPenalty,
  chaserPress,
  chaserWarning,
  clearLanePath,
  declaredPathHolds,
  emptyRecord,
  failCopy,
  fairWindows,
  forkMergeHolds,
  freeLanes,
  laneActions,
  mergeRecord,
  parseRecord,
  passableLanes,
  pathStepsAreReachable,
  recordBroken,
  recordLine,
  segmentClearPath,
  segmentIsFair,
  segmentIsPassable,
  segmentPassablePath,
  serializeRecord,
  templatesForLevel,
  tierForDistance,
  usableTemplates,
} from "./endless";
import type { FailKind } from "./endless";
import { PERFECT_STREAK_GOAL, rowIsSurvivable } from "./logic";
import type { ObstacleKind, PatternRow } from "./logic";
import { makeRng } from "../__tests__/campaignSim";

describe("无尽彩虹跑 · 难度随距离升", () => {
  it("六档难度按米数排好,不重不漏", () => {
    expect(ENDLESS_TIERS.length).toBe(6);
    for (let i = 0; i < ENDLESS_TIERS.length; i++) {
      expect(ENDLESS_TIERS[i].level).toBe(i + 1);
      if (i > 0) {
        expect(ENDLESS_TIERS[i].fromMeters).toBeGreaterThan(ENDLESS_TIERS[i - 1].fromMeters);
      }
    }
    expect(ENDLESS_TIERS[0].fromMeters).toBe(0);
  });

  it("越跑越远,障碍越多种、段落越长、金币越省", () => {
    for (let i = 1; i < ENDLESS_TIERS.length; i++) {
      const prev = ENDLESS_TIERS[i - 1];
      const cur = ENDLESS_TIERS[i];
      expect(cur.kinds.length).toBeGreaterThanOrEqual(prev.kinds.length);
      expect(cur.rows).toBeGreaterThanOrEqual(prev.rows);
      expect(cur.coinRate).toBeLessThan(prev.coinRate);
      // 三条道减掉必过的那条只剩两条,障碍上限永远塞不满
      expect(cur.maxObstacles).toBeLessThanOrEqual(2);
    }
    expect(ENDLESS_TIERS[5].kinds.length).toBe(8);
  });

  it("按米数取档:开局最简单,四千米之后是最难那一档", () => {
    expect(tierForDistance(0).level).toBe(1);
    expect(tierForDistance(399).level).toBe(1);
    expect(tierForDistance(400).level).toBe(2);
    expect(tierForDistance(1700).level).toBe(4);
    expect(tierForDistance(4000).level).toBe(6);
    expect(tierForDistance(99999).level).toBe(6);
    expect(tierForDistance(-50).level).toBe(1);
  });

  it("模板按难度解锁:开局只有两种,最难那一档八种全开", () => {
    expect(templatesForLevel(1).length).toBe(2);
    expect(templatesForLevel(6).length).toBe(SEGMENT_TEMPLATES.length);
    for (const t of SEGMENT_TEMPLATES) {
      expect(t.minLevel).toBeGreaterThanOrEqual(1);
      expect(t.minLevel).toBeLessThanOrEqual(6);
      expect(t.favor.length).toBeGreaterThan(0);
    }
  });
});

describe("无尽彩虹跑 · 必过窗口", () => {
  it("必过车道每行最多横移一格,而且不会走出三条道", () => {
    const rng = makeRng(7);
    for (const shape of ["straight", "zigzag", "drift", "weave"] as const) {
      for (let i = 0; i < 200; i++) {
        const path = clearLanePath(shape, i % 3, 6, rng);
        expect(path.length).toBe(6);
        expect(path[0]).toBe(i % 3);
        expect(pathStepsAreReachable(path), `${shape} 走出了跨两格`).toBe(true);
      }
    }
  });

  it("空车道认得准:摆了障碍的道就不是空道", () => {
    expect(freeLanes({ obstacles: [], stars: [], coins: [] })).toEqual([0, 1, 2]);
    expect(freeLanes({ obstacles: [{ lane: 1, kind: "rock" }], stars: [], coins: [] })).toEqual([0, 2]);
    expect(
      freeLanes({
        obstacles: [
          { lane: 0, kind: "rock" },
          { lane: 1, kind: "hurdle" },
          { lane: 2, kind: "bar" },
        ],
        stars: [],
        coins: [],
      }),
    ).toEqual([]);
  });

  it("校验器会拒绝走不通的组合:要横跨两格才躲得开就算过不去", () => {
    const rows = [
      { obstacles: [{ lane: 2, kind: "rock" as const }], stars: [], coins: [] },
      {
        obstacles: [
          { lane: 0, kind: "rock" as const },
          { lane: 1, kind: "rock" as const },
        ],
        stars: [],
        coins: [],
      },
    ];
    // 站在 0 道,下一行只有 2 道是空的,一次换道够不着
    expect(segmentClearPath(rows, 0)).toBeNull();
    // 站在 1 道就够得着
    expect(segmentClearPath(rows, 1)).toEqual([1, 2]);
  });

  it("校验器会拒绝三条道全被堵死的那一行", () => {
    const rows = [
      {
        obstacles: [
          { lane: 0, kind: "rock" as const },
          { lane: 1, kind: "roller" as const },
          { lane: 2, kind: "zapper" as const },
        ],
        stars: [],
        coins: [],
      },
    ];
    expect(segmentClearPath(rows, 1)).toBeNull();
    expect(rowIsSurvivable(rows[0])).toBe(false);
  });

  it("起点那一行就被堵住也算过不去,空段落原样放行", () => {
    const blocked = [{ obstacles: [{ lane: 1, kind: "rock" as const }], stars: [], coins: [] }];
    expect(segmentClearPath(blocked, 1)).toBeNull();
    expect(segmentClearPath(blocked, 0)).toEqual([0]);
    expect(segmentClearPath([], 1)).toEqual([]);
  });

  it("随机 2000 段:每一段都找得出必过路线,一段都不会生成成死局", () => {
    const rng = makeRng(20260826);
    let lane = 1;
    let dist = 0;
    let rows = 0;
    const shapes = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const seg = buildSegment(dist, lane, rng);
      shapes.add(seg.name);
      rows += seg.rows.length;

      // 1. 每一行本身有活路
      for (const row of seg.rows) {
        expect(rowIsSurvivable(row), `第 ${i} 段「${seg.name}」有一行被堵死了`).toBe(true);
      }
      // 2. 生成器自己报的那条必过路线站得住脚
      expect(seg.clearPath.length).toBe(seg.rows.length);
      expect(seg.clearPath[0]).toBe(lane);
      expect(pathStepsAreReachable(seg.clearPath), `第 ${i} 段的必过路线跨了两格`).toBe(true);
      for (let r = 0; r < seg.rows.length; r++) {
        // 1.2 起,必过路线上允许出现「跳得过 / 滑得过」的障碍(三连节拍、低梁抢道就靠这个)。
        // 平跑那一行的口径没放松,仍旧要求整条车道是空的;
        // 要动作的那一行则改成断言那个动作真能过去,由 declaredPathHolds 逐行核对。
        if (seg.pathActions[r] === "run") {
          expect(
            freeLanes(seg.rows[r]),
            `第 ${i} 段第 ${r} 行的必过车道上居然摆了障碍`,
          ).toContain(seg.clearPath[r]);
        } else {
          expect(
            passableLanes(seg.rows[r]),
            `第 ${i} 段第 ${r} 行的必过车道既跳不过也滑不过`,
          ).toContain(seg.clearPath[r]);
        }
      }
      expect(declaredPathHolds(seg), `第 ${i} 段报的动作序列走不通`).toBe(true);
      // 3. 独立的校验器也能自己找出一条来
      expect(
        segmentPassablePath(seg.rows, lane),
        `第 ${i} 段「${seg.name}」找不到必过路线`,
      ).not.toBeNull();
      expect(segmentIsPassable(seg, lane), `第 ${i} 段「${seg.name}」没过必过窗口校验`).toBe(true);

      lane = seg.clearPath[seg.clearPath.length - 1];
      dist += seg.rows.length * 250 * 0.02 + 3;
    }
    expect(rows).toBeGreaterThan(2000 * 4);
    // 一路跑下来八种模板应该都见过
    expect(shapes.size).toBe(SEGMENT_TEMPLATES.length);
  });

  it("段与段之间接得上:新一段的第一行就站在上一段收尾那条道上", () => {
    const rng = makeRng(99);
    let lane = 2;
    for (let i = 0; i < 300; i++) {
      const seg = buildSegment(i * 30, lane, rng);
      expect(seg.startLane).toBe(lane);
      expect(seg.clearPath[0]).toBe(lane);
      lane = seg.clearPath[seg.clearPath.length - 1];
    }
  });

  it("生成的障碍只用本档解锁的种类,难度不会偷跑", () => {
    const rng = makeRng(5);
    for (const dist of [0, 500, 1000, 2000, 3000, 5000]) {
      const allowed = new Set(tierForDistance(dist).kinds);
      for (let i = 0; i < 120; i++) {
        for (const row of buildSegment(dist, 1, rng).rows) {
          for (const o of row.obstacles) expect(allowed.has(o.kind), `${dist} 米出现了 ${o.kind}`).toBe(true);
        }
      }
    }
  });

  it("必过窗口:任意连续 3 行都不会三条道全是既不可跳又不可滑", () => {
    // 构造反例:三条道全摆软糖(只能换道躲),窗口立刻不成立
    const deadRow: PatternRow = {
      obstacles: [0, 1, 2].map((lane) => ({ lane, kind: "rock" as ObstacleKind })),
      stars: [],
      coins: [],
    };
    const openRow: PatternRow = { obstacles: [], stars: [], coins: [] };
    expect(fairWindows([openRow, openRow, openRow])).toBe(true);
    expect(fairWindows([openRow, deadRow, openRow])).toBe(false);
    // 跳得过 / 滑得过的三行照样成立
    const jumpRow: PatternRow = {
      obstacles: [0, 1, 2].map((lane) => ({ lane, kind: "hurdle" as ObstacleKind })),
      stars: [],
      coins: [],
    };
    const slideRow: PatternRow = {
      obstacles: [0, 1, 2].map((lane) => ({ lane, kind: "bar" as ObstacleKind })),
      stars: [],
      coins: [],
    };
    expect(fairWindows([jumpRow, slideRow, jumpRow])).toBe(true);
    expect(FAIR_WINDOW_ROWS).toBe(3);
  });

  it("必过窗口也管「横移超过一格」:中间一行只剩对面那条道就不算过得去", () => {
    const leftOnly: PatternRow = {
      obstacles: [
        { lane: 1, kind: "rock" },
        { lane: 2, kind: "rock" },
      ],
      stars: [],
      coins: [],
    };
    const rightOnly: PatternRow = {
      obstacles: [
        { lane: 0, kind: "rock" },
        { lane: 1, kind: "rock" },
      ],
      stars: [],
      coins: [],
    };
    // 只剩 0 道 → 只剩 2 道,一帧横移两格,过不去
    expect(fairWindows([leftOnly, rightOnly], 2)).toBe(false);
  });

  it("四种 1.2 新模板各跑 2000 段,全都过必过窗口", () => {
    const fresh = SEGMENT_TEMPLATES.filter((t) => typeof t.build === "function");
    expect(fresh.map((t) => t.name)).toEqual(["三连节拍", "低梁抢道", "彩纸箱链", "分岔合流"]);
    for (const template of fresh) {
      const rng = makeRng(20260826);
      // 从这个模板解锁的那一档往上取距离,保证它需要的障碍都齐了
      const tier = ENDLESS_TIERS[template.minLevel - 1];
      for (let i = 0; i < 2000; i++) {
        const startLane = i % 3;
        const dist = tier.fromMeters + (i % 900);
        const seg = buildSegmentWith(template, dist, startLane, rng);
        expect(seg.name).toBe(template.name);
        expect(seg.startLane).toBe(startLane);
        for (const row of seg.rows) {
          expect(rowIsSurvivable(row), `「${template.name}」第 ${i} 段有一行被堵死了`).toBe(true);
        }
        expect(fairWindows(seg.rows), `「${template.name}」第 ${i} 段没过必过窗口`).toBe(true);
        expect(
          segmentIsPassable(seg, startLane),
          `「${template.name}」第 ${i} 段从第 ${startLane} 道进来走不通`,
        ).toBe(true);
        expect(declaredPathHolds(seg), `「${template.name}」第 ${i} 段报的动作走不通`).toBe(true);
        expect(seg.rows.length).toBeGreaterThanOrEqual(tier.rows);
      }
    }
  });

  it("三连节拍:连着三行同款障碍摆满三条道,只能一拍一跳", () => {
    const template = SEGMENT_TEMPLATES.find((t) => t.name === "三连节拍");
    expect(template).toBeDefined();
    const rng = makeRng(4);
    for (let i = 0; i < 200; i++) {
      const seg = buildSegmentWith(template!, 2200, i % 3, rng);
      const beats = seg.rows.filter((r) => r.beat === true);
      expect(beats.length).toBe(PERFECT_STREAK_GOAL);
      for (const row of beats) {
        // 三条道全摆上,而且是同一种障碍——节奏段不该有「要不要换道」的干扰
        expect(row.obstacles.length).toBe(3);
        expect(new Set(row.obstacles.map((o) => o.kind)).size).toBe(1);
        expect(new Set(row.obstacles.map((o) => o.lane))).toEqual(new Set([0, 1, 2]));
      }
      // 三拍都记成「跳」,而且必过车道一格没挪
      const jumpRows = seg.pathActions.filter((a) => a === "jump");
      expect(jumpRows.length).toBe(PERFECT_STREAK_GOAL);
      expect(new Set(seg.clearPath).size).toBe(1);
    }
  });

  it("低梁抢道:趴过低梁那一行的下一行原道被堵死,只能立刻换到旁边", () => {
    const template = SEGMENT_TEMPLATES.find((t) => t.name === "低梁抢道");
    const rng = makeRng(17);
    for (let i = 0; i < 300; i++) {
      const seg = buildSegmentWith(template!, 2400, i % 3, rng);
      let cuts = 0;
      for (let r = 0; r < seg.rows.length - 1; r++) {
        if (seg.pathActions[r] !== "slide") continue;
        cuts++;
        const here = seg.clearPath[r];
        const next = seg.clearPath[r + 1];
        // 低梁压在自己这条道上,滑过去
        expect(seg.rows[r].obstacles.some((o) => o.lane === here && o.kind === "bar")).toBe(true);
        // 下一行原道被软糖封死,而且必须挪一格
        expect(seg.rows[r + 1].obstacles.some((o) => o.lane === here && o.kind === "rock")).toBe(
          true,
        );
        expect(Math.abs(next - here)).toBe(1);
        expect(freeLanes(seg.rows[r + 1])).toContain(next);
      }
      expect(cuts).toBeGreaterThanOrEqual(1);
    }
  });

  it("彩纸箱链:一整串箱子铺在同一条道上,一路滑过去挨个铲碎", () => {
    const template = SEGMENT_TEMPLATES.find((t) => t.name === "彩纸箱链");
    const rng = makeRng(23);
    for (let i = 0; i < 300; i++) {
      const seg = buildSegmentWith(template!, 2300, i % 3, rng);
      const links = seg.pathActions.filter((a) => a === "slide").length;
      expect(links).toBeGreaterThanOrEqual(3);
      for (let r = 0; r < seg.rows.length; r++) {
        if (seg.pathActions[r] !== "slide") continue;
        const ob = seg.rows[r].obstacles.find((o) => o.lane === seg.clearPath[r]);
        expect(ob?.kind).toBe("crate");
        // 箱子是唯一「跳也行、滑也行」的障碍,手生的孩子也留了退路
        expect(laneActions(seg.rows[r], seg.clearPath[r]).sort()).toEqual(["jump", "slide"]);
      }
      // 整条链子都在同一条道上
      expect(new Set(seg.clearPath).size).toBe(1);
    }
  });

  it("分岔合流:两条支线各自走得通,而且在同一行汇合", () => {
    const template = SEGMENT_TEMPLATES.find((t) => t.name === "分岔合流");
    const rng = makeRng(41);
    for (let i = 0; i < 400; i++) {
      const seg = buildSegmentWith(template!, 3200, i % 3, rng);
      expect(seg.merge).toBeDefined();
      const merge = seg.merge!;
      // 中间道从岔路口一路被封到合流前一行
      for (let r = 1; r < merge.row; r++) {
        expect(seg.rows[r].obstacles.some((o) => o.lane === 1 && o.kind === "rock")).toBe(true);
      }
      // 合流那一行三条道同时放开——两边的人这一帧回到同一条路面上
      expect(freeLanes(seg.rows[merge.row])).toEqual([0, 1, 2]);
      expect(merge.lanes).toEqual([0, 2]);
      expect(forkMergeHolds(seg)).toBe(true);
      // 两条支线一样长:谁走哪边都不会被多堵一行
      for (const lane of merge.lanes) {
        const branch = segmentPassablePath(seg.rows.slice(0, merge.row + 1), lane);
        expect(branch, `第 ${lane} 道的支线走不到合流点`).not.toBeNull();
        expect(branch?.length).toBe(merge.row + 1);
      }
    }
  });

  it("不是分岔段就没有合流点,不会被当成「岔路坏了」", () => {
    const rng = makeRng(3);
    const plain = SEGMENT_TEMPLATES.find((t) => t.name === "糖果直道")!;
    expect(forkMergeHolds(buildSegmentWith(plain, 0, 1, rng))).toBeNull();
  });

  it("模板得等它要的障碍都解锁了才抽得到,不会摆出一段没法生成的路", () => {
    for (const tier of ENDLESS_TIERS) {
      const kinds = new Set(tier.kinds);
      const usable = usableTemplates(tier);
      expect(usable.length).toBeGreaterThan(0);
      for (const t of usable) {
        expect(t.minLevel).toBeLessThanOrEqual(tier.level);
        for (const need of t.needs ?? []) expect(kinds.has(need)).toBe(true);
      }
    }
    // 最高档十二种模板一个不少
    expect(usableTemplates(ENDLESS_TIERS[ENDLESS_TIERS.length - 1]).length).toBe(
      SEGMENT_TEMPLATES.length,
    );
  });

  it("必过路线上的动作只会是 run / jump / slide 这三种", () => {
    const rng = makeRng(64);
    let lane = 1;
    for (let i = 0; i < 600; i++) {
      const seg = buildSegment(i * 20, lane, rng);
      for (const a of seg.pathActions) expect(["run", "jump", "slide"]).toContain(a);
      lane = seg.clearPath[seg.clearPath.length - 1];
    }
  });

  it("糖果和星星不叠在同一格上,金币也不会摆到障碍头上", () => {
    const rng = makeRng(31);
    for (let i = 0; i < 400; i++) {
      for (const row of buildSegment(i * 12, i % 3, rng).rows) {
        for (const star of row.stars) expect(row.coins).not.toContain(star);
        for (const coin of row.coins) {
          expect(row.obstacles.some((o) => o.lane === coin)).toBe(false);
        }
        for (const lane of [...row.coins, ...row.stars, ...(row.rails ?? [])]) {
          expect(lane).toBeGreaterThanOrEqual(0);
          expect(lane).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});

describe("无尽彩虹跑 · 追风棉花云", () => {
  it("追赶物是本作原创的角色,开局就领先它一大截", () => {
    expect(CHASER_NAME).toBe("追风棉花云");
    expect(CHASER_START_GAP).toBeGreaterThan(CHASER_WARN_GAP);
    expect(CHASER_MAX_GAP).toBeGreaterThan(CHASER_START_GAP);
  });

  it("跑得越远它压得越紧,但压力有封顶", () => {
    expect(chaserPress(0)).toBeGreaterThan(0);
    expect(chaserPress(3000)).toBeGreaterThan(chaserPress(0));
    expect(chaserPress(100000)).toBe(46);
  });

  it("好好跑就甩得开:躲障碍、吃糖果、踩滑轨都能拉开距离", () => {
    expect(chaserBoost(200, CHASER_DODGE_BONUS)).toBeGreaterThan(200);
    expect(chaserBoost(200, CHASER_COIN_BONUS)).toBeGreaterThan(200);
    expect(chaserBoost(200, CHASER_RAIL_BONUS)).toBe(200 + CHASER_RAIL_BONUS);
    // 甩不过上限,不能一路攒成免死金牌
    expect(chaserBoost(CHASER_MAX_GAP, 999)).toBe(CHASER_MAX_GAP);
    expect(chaserBoost(200, -50)).toBe(200);
  });

  it("撞一下被追近一大截,近到一定程度画面就该示警了", () => {
    const after = chaserPenalty(CHASER_START_GAP);
    expect(after).toBe(CHASER_START_GAP - CHASER_HIT_PENALTY);
    expect(chaserWarning(CHASER_START_GAP)).toBe(false);
    expect(chaserWarning(CHASER_WARN_GAP)).toBe(true);
    expect(chaserCaught(0)).toBe(true);
    expect(chaserCaught(1)).toBe(false);
  });

  it("开局一路好好跑追不上人,躺着不动就会被追上", () => {
    // 认真跑:每秒躲掉两个障碍、吃两颗糖果
    let gap = CHASER_START_GAP;
    for (let s = 0; s < 60; s++) {
      gap = chaserDrift(gap, 1, s * 8);
      gap = chaserBoost(gap, CHASER_DODGE_BONUS * 2 + CHASER_COIN_BONUS * 2);
    }
    expect(chaserCaught(gap)).toBe(false);

    // 摆烂:什么都不做
    let idle = CHASER_START_GAP;
    let caughtAt = -1;
    for (let s = 0; s < 120 && caughtAt < 0; s++) {
      idle = chaserDrift(idle, 1, s * 8);
      if (chaserCaught(idle)) caughtAt = s;
    }
    expect(caughtAt).toBeGreaterThan(5);
    expect(caughtAt).toBeLessThan(40);
  });

  it("dt 不合法时距离不动,60fps 与 30fps 追得一样快", () => {
    expect(chaserDrift(200, 0, 100)).toBe(200);
    expect(chaserDrift(200, -1, 100)).toBe(200);
    let fast = 300;
    for (let i = 0; i < 60; i++) fast = chaserDrift(fast, 1 / 60, 0);
    let slow = 300;
    for (let i = 0; i < 30; i++) slow = chaserDrift(slow, 1 / 30, 0);
    expect(fast).toBeCloseTo(slow, 10);
  });
});

describe("无尽彩虹跑 · 三种失败", () => {
  const kinds: FailKind[] = ["crash", "pit", "chaser"];

  it("三种失败各有各的说法,不会串台", () => {
    const titles = kinds.map((k) => failCopy(k, 500).title);
    expect(new Set(titles).size).toBe(3);
    expect(failCopy("pit", 500).title).toContain("踩空");
    expect(failCopy("chaser", 500).title).toContain(CHASER_NAME);
  });

  it("每一条都先报成绩再给办法,而且报的是这一趟真实的米数", () => {
    for (const kind of kinds) {
      const copy = failCopy(kind, 1234.7);
      expect(copy.line).toContain("1234 米");
      expect(copy.line.length).toBeGreaterThan(12);
      expect(copy.title.length).toBeGreaterThan(3);
    }
    expect(failCopy("crash", -5).line).toContain("0 米");
  });

  it("面板上分两行显示,拼起来正好是朗读的那一句,窄屏一行不会太长", () => {
    for (const kind of kinds) {
      const copy = failCopy(kind, 1234);
      expect(copy.lines.length).toBe(2);
      expect(copy.lines.join("")).toBe(copy.line);
      // 第一行报成绩、第二行给办法,两行都不超过 375 宽窄屏放得下的长度
      expect(copy.lines[0]).toContain("1234 米");
      for (const l of copy.lines) {
        expect(l.trim().length).toBeGreaterThan(3);
        expect(l.length, `${kind} 这一行太长了:${l}`).toBeLessThanOrEqual(30);
      }
    }
  });

  it("失败文案只鼓励不批评:一个责备的字眼都没有", () => {
    const scold = ["笨", "傻", "菜", "怎么又", "太差", "不行", "失败了", "输了", "别再", "没用"];
    for (const kind of kinds) {
      const copy = failCopy(kind, 800);
      for (const bad of scold) {
        expect(copy.title.includes(bad), `${kind} 标题出现了「${bad}」`).toBe(false);
        expect(copy.line.includes(bad), `${kind} 正文出现了「${bad}」`).toBe(false);
      }
      // 每一条都带一句「再来一次也行 / 下一趟更远」这样的鼓励
      expect(/再来一次|下一趟|更远|准/.test(copy.line), kind).toBe(true);
    }
  });

  it("失败文案全中文:按键也用中文说,不夹外文字母", () => {
    for (const kind of kinds) {
      const copy = failCopy(kind, 640);
      expect(copy.title, copy.title).not.toMatch(/[A-Za-z]/);
      expect(copy.line, copy.line).not.toMatch(/[A-Za-z]/);
    }
    // 段落名与难度档名同样只用中文
    for (const t of ENDLESS_TIERS) expect(t.name, t.name).not.toMatch(/[A-Za-z]/);
    for (const t of SEGMENT_TEMPLATES) expect(t.name, t.name).not.toMatch(/[A-Za-z]/);
    expect(CHASER_NAME).not.toMatch(/[A-Za-z]/);
  });
});

describe("无尽彩虹跑 · 最远距离与最高金币数", () => {
  it("两项纪录各记各的,谁破了记谁", () => {
    const prev = { meters: 900, coins: 40 };
    expect(mergeRecord(prev, { meters: 1200, coins: 12 })).toEqual({ meters: 1200, coins: 40 });
    expect(mergeRecord(prev, { meters: 100, coins: 88 })).toEqual({ meters: 900, coins: 88 });
    expect(mergeRecord(prev, { meters: 1200, coins: 88 })).toEqual({ meters: 1200, coins: 88 });
    expect(mergeRecord(prev, { meters: 10, coins: 1 })).toEqual(prev);
  });

  it("破没破纪录分得清,播报也跟着变", () => {
    const prev = { meters: 900, coins: 40 };
    expect(recordBroken(prev, { meters: 901, coins: 40 })).toEqual({ meters: true, coins: false });
    expect(recordBroken(prev, { meters: 900, coins: 41 })).toEqual({ meters: false, coins: true });
    expect(recordLine(prev, { meters: 1000, coins: 50 })).toContain("一起破纪录");
    expect(recordLine(prev, { meters: 1000, coins: 10 })).toContain("最远距离破纪录");
    expect(recordLine(prev, { meters: 10, coins: 50 })).toContain("糖果数破纪录");
    expect(recordLine(prev, { meters: 10, coins: 10 })).toContain("900 米");
  });

  it("存档存得进也读得出,一趟往返数不变", () => {
    const r = { meters: 2345, coins: 178 };
    expect(parseRecord(serializeRecord(r))).toEqual(r);
    expect(parseRecord(null)).toEqual(emptyRecord());
    expect(parseRecord("")).toEqual(emptyRecord());
  });

  it("坏存档不会把无尽模式卡住,老版本只存米数的也读得懂", () => {
    expect(parseRecord("{坏掉的}")).toEqual({ meters: 0, coins: 0 });
    expect(parseRecord("1500")).toEqual({ meters: 1500, coins: 0 });
    expect(parseRecord('{"meters":-3,"coins":"abc"}')).toEqual({ meters: 0, coins: 0 });
    expect(parseRecord('{"meters":12.9,"coins":7.2}')).toEqual({ meters: 12, coins: 7 });
  });
});
