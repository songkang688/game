/**
 * 便便超人 · 1.2 升级用例。
 *
 * 1.1 的那两份用例(logic.test.ts / levels.test.ts)一条都没删,这里只往上加:
 * 手感常量与帧率无关、垃圾分类三色桶、三种新关卡、合作分工、无尽脏乱度、
 * 360px 摇杆布局、`destroy` 归零,以及「前 99 关一个数都没动」的回归摘要。
 */
import { describe, expect, it } from "vitest";
import {
  MISSION_FROM_LEVEL,
  MISSION_INFO,
  TOTAL,
  buildCoop,
  buildEndless,
  buildLevel,
  endlessBlockPlan,
  groundSolidAt,
  messRateFor,
  missionOf,
  type LevelDef,
  type MissionKind,
} from "./levels";
import {
  BINS,
  HYGIENE_TIPS,
  TRASH_ITEMS,
  binInfo,
  binOf,
  checkSort,
  hygieneTip,
  itemAt,
  itemsForBin,
  trashById,
  type BinKind,
} from "./trash";
import {
  BIN_RANGE,
  CART_SPEED,
  HANDLING,
  MAX_SUBSTEP,
  MOVE_SPEED,
  RAIN_FRICTION,
  SLIP_FRICTION,
  SORT_STAR,
  botInput,
  canClean,
  canHaul,
  cartDelivered,
  coopStars,
  createWorld,
  doorOpen,
  emptyInput,
  frictionFor,
  isSlippery,
  jumpApex,
  jumpRange,
  messAfter,
  roleOf,
  starGoals,
  starPoints,
  stepWorld,
  summarize,
  type Input,
  type World,
} from "./logic";
import {
  MIN_HOT,
  MIN_HOT_DUO,
  createDisposer,
  padMetrics,
  padOverlaps,
  parseLevelParam,
  resolveInitialLevel,
} from "./runtime";

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function press(over: Partial<Input> = {}): Input {
  return { ...emptyInput(), ...over };
}

/** 按住某组键跑 seconds 秒 */
function hold(w: World, input: Input, seconds: number, fps = 60): void {
  const dt = 1 / fps;
  for (let i = 0; i < Math.round(seconds * fps) && w.status === "playing"; i++) {
    stepWorld(w, dt, [input]);
  }
}

/** 让机器人把这一关玩到底,返回世界本身 */
function botRun(def: LevelDef, players = 1, maxSeconds = 200): World {
  const w = createWorld(def, players);
  const limit = Math.round(maxSeconds * 60);
  for (let i = 0; i < limit && w.status === "playing"; i++) {
    stepWorld(w, 1 / 60, w.players.map((_, pi) => botInput(w, pi)));
  }
  return w;
}

/** 第一关往后第一道用得上某种任务的关号 */
function firstLevelWith(mission: MissionKind): number {
  for (let i = MISSION_FROM_LEVEL; i < TOTAL; i++) if (missionOf(i) === mission) return i;
  throw new Error(`188 关里找不到 ${mission} 任务`);
}

/** 战役关的几何与数值摘要:1.2 新加的字段不算在里面 */
function geometryDigest(d: LevelDef): string {
  return JSON.stringify({
    name: d.name,
    len: d.len,
    goalX: d.goalX,
    gaps: d.gaps,
    platforms: d.platforms,
    monsters: d.monsters,
    stains: d.stains,
    sludges: d.sludges,
    sparkles: d.sparkles,
    springs: d.springs,
    beams: d.beams,
    junks: d.junks,
    chaserSpeed: d.chaserSpeed,
    slippery: d.slippery,
    requiredRatio: d.requiredRatio,
    parSeconds: d.parSeconds,
    sparkleGoal: d.sparkleGoal,
    timeLimit: d.timeLimit,
    hearts: d.hearts,
  });
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** 面向孩子的红线词:低俗、恶心、责备,一个都不许出现 */
const BANNED_WORDS = ["屎", "尿", "屁股", "恶心", "呕", "吐了", "肮脏", "恶臭", "臭", "笨", "蠢", "傻", "垃圾人"];

/** 商标黑名单:一个都不许蹭 */
const TRADEMARKS = [
  "愤怒的小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "森林冰火人",
  "屁王兄弟",
  "拳皇",
  "街霸",
  "超级玛丽",
  "马里奥",
  "割绳子",
  "俄罗斯方块",
  "Tetris",
  "贪吃蛇大作战",
  "球球大作战",
  "我的世界",
  "Minecraft",
  "三国杀",
  "大富翁",
  "斗地主",
  "Pac-Man",
  "吃豆人",
  "宝可梦",
  "皮卡丘",
  "奥特曼",
  "喜羊羊",
  "蛋仔",
  "原神",
  "王者荣耀",
];

// ---------------------------------------------------------------------------
// 一、手感常量与帧率无关
// ---------------------------------------------------------------------------

describe("poop-hero 1.2 · 手感常量", () => {
  it("移动、跳跃、清扫范围、冷却全在 tuning 里,HANDLING 快照和它们一一对上", () => {
    expect(HANDLING.moveSpeed).toBe(MOVE_SPEED);
    expect(HANDLING.slipFriction).toBe(SLIP_FRICTION);
    expect(HANDLING.rainFriction).toBe(RAIN_FRICTION);
    expect(HANDLING.maxSubstep).toBe(MAX_SUBSTEP);
    expect(HANDLING.cartSpeed).toBe(CART_SPEED);
    expect(HANDLING.binRange).toBe(BIN_RANGE);
    // 一份冻起来的只读快照:谁想在别处偷偷改一个魔法数字,这里立刻发现
    expect(Object.isFrozen(HANDLING)).toBe(true);
    for (const [key, value] of Object.entries(HANDLING)) {
      expect(typeof value, `${key} 应该是个数`).toBe("number");
      expect(value, `${key} 应该是正数`).toBeGreaterThan(0);
    }
  });

  it("跳跃常量算出来的高度和跨度,仍然盖得住关卡生成器的上限", () => {
    // 这两条在 1.1 就有,1.2 把常量搬了家,再钉一次免得搬漏
    expect(jumpApex()).toBeGreaterThan(96);
    expect(jumpRange()).toBeGreaterThan(128);
  });

  it("30fps 和 60fps 跑同样的两秒,位移差不到 2%", () => {
    const runAt = (fps: number): number => {
      const w = createWorld(buildLevel(0), 1);
      hold(w, press({ right: true }), 2, fps);
      return w.players[0].x;
    };
    const fast = runAt(60);
    const slow = runAt(30);
    expect(fast).toBeGreaterThan(300);
    expect(Math.abs(fast - slow) / fast).toBeLessThan(0.02);
  });

  it("30fps 和 60fps 起跳的最高点也差不到 2%", () => {
    const apexAt = (fps: number): number => {
      const w = createWorld(buildLevel(0), 1);
      const dt = 1 / fps;
      let top = 0;
      for (let i = 0; i < Math.round(fps * 1.2); i++) {
        stepWorld(w, dt, [press({ right: true, up: true })]);
        top = Math.min(top, w.players[0].y);
      }
      return Math.abs(top);
    };
    const fast = apexAt(60);
    const slow = apexAt(30);
    expect(fast).toBeGreaterThan(60);
    expect(Math.abs(fast - slow) / fast).toBeLessThan(0.02);
  });

  it("卡了一帧(dt=0.2s)也会被切成子步,和逐帧跑出来的位置几乎一样", () => {
    const smooth = createWorld(buildLevel(0), 1);
    hold(smooth, press({ right: true }), 0.2, 60);
    const stuttered = createWorld(buildLevel(0), 1);
    stepWorld(stuttered, 0.2, [press({ right: true })]);
    expect(Math.abs(smooth.players[0].x - stuttered.players[0].x)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// 二、垃圾分类数据(给孩子的常识,必须真实正确)
// ---------------------------------------------------------------------------

describe("poop-hero 1.2 · 三色桶分类表", () => {
  it("三只桶按可回收 → 厨余 → 其他排好,每只都有名字、颜色和一句话说明", () => {
    expect(BINS.map((b) => b.kind)).toEqual(["recycle", "kitchen", "other"]);
    for (const b of BINS) {
      expect(b.name.length).toBeGreaterThan(1);
      expect(b.short.length).toBeGreaterThan(1);
      expect(b.hint.length).toBeGreaterThan(8);
      expect(b.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(binInfo(b.kind)).toBe(b);
    }
  });

  it("18 条分类数据,三个桶各 6 条,id 不重复", () => {
    expect(TRASH_ITEMS.length).toBe(18);
    expect(new Set(TRASH_ITEMS.map((t) => t.id)).size).toBe(18);
    for (const b of BINS) expect(itemsForBin(b.kind).length, `${b.name}应有 6 条`).toBe(6);
  });

  it("每一条都投在真正对的桶里(逐条钉死,内容要经得起孩子问)", () => {
    const truth: Record<string, BinKind> = {
      bottle: "recycle",
      can: "recycle",
      paper: "recycle",
      carton: "recycle",
      glass: "recycle",
      cloth: "recycle",
      apple: "kitchen",
      banana: "kitchen",
      leaf: "kitchen",
      egg: "kitchen",
      rice: "kitchen",
      tea: "kitchen",
      tissue: "other",
      chopstick: "other",
      ceramic: "other",
      brush: "other",
      wrap: "other",
      dust: "other",
    };
    expect(Object.keys(truth).length).toBe(TRASH_ITEMS.length);
    for (const [id, bin] of Object.entries(truth)) {
      expect(binOf(id), `${id} 该进${binInfo(bin).name}`).toBe(bin);
      expect(trashById(id)?.why.length ?? 0, `${id} 得说清为什么`).toBeGreaterThan(6);
    }
    expect(binOf("不认识的东西")).toBeNull();
  });

  it("有害垃圾一条都不放进来:三色桶里教错了比不教更糟", () => {
    const text = TRASH_ITEMS.map((t) => `${t.name}${t.why}`).join();
    for (const bad of ["电池", "灯管", "药品", "药盒", "温度计", "油漆", "杀虫剂"]) {
      expect(text.includes(bad), `三色桶里不该出现有害垃圾「${bad}」`).toBe(false);
    }
  });

  it("投对了是夸奖,还会顺口讲一遍为什么", () => {
    for (const item of TRASH_ITEMS) {
      const res = checkSort(item.id, item.bin);
      expect(res.ok, `${item.name}投${binInfo(item.bin).name}应该算对`).toBe(true);
      expect(res.message).toContain(item.name);
      expect(res.message).toContain(item.why);
    }
  });

  it("投错了只温和地说该去哪个桶,一个责备的字都没有", () => {
    for (const item of TRASH_ITEMS) {
      for (const b of BINS) {
        if (b.kind === item.bin) continue;
        const res = checkSort(item.id, b.kind);
        expect(res.ok).toBe(false);
        // 只讲正确答案 + 再试一次,不出现任何否定 / 责备的词
        expect(res.message).toContain(binInfo(item.bin).name);
        expect(res.message).toContain("再试一次");
        for (const bad of ["错了", "不对", "笨", "蠢", "傻", "别乱"]) {
          expect(res.message.includes(bad), `提示里不该出现「${bad}」`).toBe(false);
        }
      }
    }
  });

  it("itemAt 与 hygieneTip 取样是确定的,越界也会绕回来", () => {
    expect(itemAt(0)).toBe(TRASH_ITEMS[0]);
    expect(itemAt(TRASH_ITEMS.length)).toBe(TRASH_ITEMS[0]);
    expect(itemAt(-1)).toBe(TRASH_ITEMS[TRASH_ITEMS.length - 1]);
    expect(hygieneTip(0)).toBe(HYGIENE_TIPS[0]);
    expect(hygieneTip(HYGIENE_TIPS.length + 2)).toBe(HYGIENE_TIPS[2]);
    // 卫生小知识全是正向的做法,不吓唬人
    for (const tip of HYGIENE_TIPS) {
      expect(tip.length).toBeGreaterThan(8);
      for (const bad of BANNED_WORDS) expect(tip.includes(bad), `「${bad}」出现在${tip}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 三、分类玩法在世界里真的跑得起来
// ---------------------------------------------------------------------------

/** 造一张只有一件垃圾和三只桶的小图,专门验分类判定 */
function sortingStage(itemId: string): LevelDef {
  const base = buildLevel(0);
  return {
    ...base,
    monsters: [],
    stains: [],
    sludges: [],
    sparkles: [],
    springs: [],
    beams: [],
    junks: [],
    gaps: [],
    platforms: [],
    chaserSpeed: null,
    litters: [{ x: 300, item: itemId }],
    // 三只桶特意拉开距离,好让用例一只一只走过去,看清每一次判定
    bins: [
      { x: 700, kind: "recycle" },
      { x: 1000, kind: "kitchen" },
      { x: 1300, kind: "other" },
    ],
    requiredRatio: 1,
    timeLimit: 0,
  };
}

describe("poop-hero 1.2 · 捡起来、投进去", () => {
  it("走过去自动抱起来,送到对的桶就投进去,还多给一颗星星", () => {
    const w = createWorld(sortingStage("bottle"), 1);
    hold(w, press({ right: true }), 1.2);
    expect(w.players[0].carry, "路过应该把瓶子抱起来").toBe("bottle");
    hold(w, press({ right: true }), 2.2);
    expect(w.sorted).toBe(1);
    expect(w.players[0].carry, "投完手上就空了").toBeNull();
    expect(w.litters[0].sorted).toBe(true);
    expect(w.sortMisses).toBe(0);
    expect(w.bins[0].lastOk).toBe(true);
    expect(starPoints(summarize(w))).toBe(SORT_STAR);
  });

  it("投错桶不扣任何分:心、星星、件数一样不动,东西还抱在手上", () => {
    // 苹果核该进绿桶,这里让它先撞上第一只蓝桶
    const w = createWorld(sortingStage("apple"), 1);
    hold(w, press({ right: true }), 1.2);
    expect(w.players[0].carry).toBe("apple");
    const heartsBefore = w.hearts;
    const sparklesBefore = w.sparklesTaken;
    hold(w, press({ right: true }), 1.5);
    expect(w.sortMisses, "蓝桶前面应该被温和地提示过一次").toBeGreaterThanOrEqual(1);
    expect(w.sorted, "投错不算件数").toBe(0);
    expect(w.hearts, "投错不扣心").toBe(heartsBefore);
    expect(w.sparklesTaken, "投错不扣星星").toBe(sparklesBefore);
    expect(w.players[0].carry, "东西还在手上,换个桶还能再投").toBe("apple");
    expect(w.sortHint).toContain("厨余垃圾");
    // 接着往前走到绿桶就投对了
    hold(w, press({ right: true }), 1.5);
    expect(w.sorted).toBe(1);
    expect(w.players[0].carry).toBeNull();
  });

  it("投对的件数会折进三星里的星星那一条", () => {
    const def = { ...sortingStage("can"), sparkleGoal: 2 };
    const dry = { win: true, cleanPct: 100, cleaned: 0, dirtTotal: 0, sparkles: 1, time: 1, hearts: 3 };
    expect(starGoals(def, dry).sparkle, "只捡到一颗还差一颗").toBe(false);
    expect(starGoals(def, { ...dry, sorted: 1 }).sparkle, "投对一件补上了那一颗").toBe(true);
  });

  it("前 99 关一只桶都没有,第 100 关起才摆分类站", () => {
    for (let i = 0; i < MISSION_FROM_LEVEL; i++) {
      const d = buildLevel(i);
      expect(d.bins.length, `第 ${i + 1} 关不该有桶`).toBe(0);
      expect(d.litters.length, `第 ${i + 1} 关不该有垃圾`).toBe(0);
    }
    for (const i of [MISSION_FROM_LEVEL, 120, 150, TOTAL - 1]) {
      const d = buildLevel(i);
      expect(d.bins.length, `第 ${i + 1} 关该有三色桶`).toBe(3);
      expect(d.bins.map((b) => b.kind)).toEqual(["recycle", "kitchen", "other"]);
      expect(d.litters.length).toBeGreaterThan(0);
      // 桶和垃圾都得站在实心地面上,够得着
      for (const b of d.bins) expect(groundSolidAt(d, b.x)).toBe(true);
      for (const l of d.litters) {
        expect(groundSolidAt(d, l.x)).toBe(true);
        expect(binOf(l.item), `${l.item} 得是分类表里的东西`).not.toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 四、三种新关卡
// ---------------------------------------------------------------------------

describe("poop-hero 1.2 · 限时清扫 / 护送清洁车 / 暴雨天", () => {
  it("前 99 关全是普通清扫,第 100 关起三种新任务都轮得到", () => {
    for (let i = 0; i < MISSION_FROM_LEVEL; i++) {
      expect(missionOf(i), `第 ${i + 1} 关不该换任务`).toBe("sweep");
      expect(buildLevel(i).mission).toBe("sweep");
      expect(buildLevel(i).weather).toBe("clear");
      expect(buildLevel(i).cart).toBeNull();
    }
    const later = new Set<MissionKind>();
    for (let i = MISSION_FROM_LEVEL; i < TOTAL; i++) later.add(missionOf(i));
    expect([...later].sort()).toEqual(["escort", "storm", "sweep", "timed"]);
    for (const kind of ["timed", "escort", "storm"] as const) {
      expect(MISSION_INFO[kind].label.length).toBeGreaterThan(1);
      expect(MISSION_INFO[kind].hint.length).toBeGreaterThan(8);
    }
  });

  it("限时清扫的钟明显更紧,但仍留得下两倍标准用时", () => {
    const timed = buildLevel(firstLevelWith("timed"));
    expect(timed.mission).toBe("timed");
    expect(timed.timeLimit).toBeGreaterThan(timed.parSeconds * 2);
    // 同章的普通清扫关宽松得多,一比就看得出来「限时」不是嘴上说说
    const plain = buildLevel(firstLevelWith("sweep"));
    expect(timed.timeLimit / timed.parSeconds).toBeLessThan(plain.timeLimit / plain.parSeconds);
    expect(timed.feature).toBe(MISSION_INFO.timed.label);
  });

  it("护送关有一辆清洁车,而且不放断口、不放追逐(推着车过不去)", () => {
    for (let i = MISSION_FROM_LEVEL; i < TOTAL; i++) {
      if (missionOf(i) !== "escort") continue;
      const d = buildLevel(i);
      expect(d.cart, `第 ${i + 1} 关该有清洁车`).not.toBeNull();
      expect(d.gaps.length, `第 ${i + 1} 关不该有断口`).toBe(0);
      expect(d.chaserSpeed, `第 ${i + 1} 关不该有追逐`).toBeNull();
      // 标准用时得把推车那一段算进去
      expect(d.parSeconds).toBeGreaterThan((d.goalX - d.cart!.x) / CART_SPEED);
    }
  });

  it("没人推车它就不走;站到车尾才推得动", () => {
    const def = buildLevel(firstLevelWith("escort"));
    const idle = createWorld(def, 1);
    const startX = idle.cart!.x;
    hold(idle, emptyInput(), 3);
    expect(idle.cart!.pushed).toBe(false);
    expect(idle.cart!.x).toBeCloseTo(startX, 5);

    // 人比车快,所以要一路陪着它 —— 机器人正是这么打护送关的
    const pushing = createWorld(def, 1);
    let everPushed = false;
    for (let i = 0; i < 60 * 3 && pushing.status === "playing"; i++) {
      stepWorld(pushing, 1 / 60, [botInput(pushing, 0)]);
      everPushed = everPushed || pushing.cart!.pushed;
    }
    expect(everPushed, "跑到车尾就该推起来了").toBe(true);
    expect(pushing.cart!.x).toBeGreaterThan(startX + 20);
    // 推着走的速度就是常量里那一档,比人跑得慢
    expect(pushing.cart!.x - startX).toBeLessThanOrEqual(CART_SPEED * 3 + 1);
  });

  it("车没送到净化门,路扫得再干净也不算过关", () => {
    const def = buildLevel(firstLevelWith("escort"));
    const w = createWorld(def, 1);
    // 直接把路上的脏东西全算清掉,再把人挪到门口
    w.cleaned = w.dirtTotal;
    for (const m of w.monsters) m.clean = true;
    for (const s of w.stains) s.clean = true;
    for (const s of w.sludges) s.clean = true;
    w.players[0].x = def.goalX;
    expect(doorOpen(w)).toBe(true);
    expect(cartDelivered(w)).toBe(false);
    hold(w, emptyInput(), 0.5);
    expect(w.status, "车还在半路,门口也不算赢").toBe("playing");
    // 把车推到门口就成了
    w.cart!.x = def.goalX;
    hold(w, emptyInput(), 0.5);
    expect(cartDelivered(w)).toBe(true);
    expect(w.status).toBe("won");
  });

  it("暴雨天地面更滑:松手以后溜得比洗衣坊还远", () => {
    const storm = buildLevel(firstLevelWith("storm"));
    expect(storm.weather).toBe("storm");
    expect(storm.gaps.length, "湿滑路面不该让人踩空").toBe(0);
    expect(isSlippery(storm)).toBe(true);
    expect(frictionFor(storm)).toBe(RAIN_FRICTION);
    expect(RAIN_FRICTION).toBeLessThan(SLIP_FRICTION);

    const glide = (def: LevelDef): number => {
      const w = createWorld({ ...def, chaserSpeed: null }, 1);
      hold(w, press({ right: true }), 1.5);
      const from = w.players[0].x;
      hold(w, emptyInput(), 1);
      return w.players[0].x - from;
    };
    const rain = glide(storm);
    const laundry = glide({ ...storm, weather: "clear", slippery: true });
    const dry = glide({ ...storm, weather: "clear", slippery: false });
    expect(dry).toBeLessThan(1);
    expect(laundry).toBeGreaterThan(dry);
    expect(rain, "雨天惯性要明显大过洗衣坊").toBeGreaterThan(laundry * 1.2);
  });
});

// ---------------------------------------------------------------------------
// 五、合作深化:两个人分工才拿得到三星
// ---------------------------------------------------------------------------

describe("poop-hero 1.2 · 双人分工", () => {
  it("合作图两个人分头做:0 号只清扫,1 号只搬运", () => {
    const def = buildCoop(0);
    expect(def.roles).toBe(true);
    expect(def.haulGoal).toBeGreaterThan(0);
    expect(def.bins.length).toBe(3);
    expect(roleOf(def, 0, 2)).toBe("sweeper");
    expect(roleOf(def, 1, 2)).toBe("hauler");
    expect(canClean("sweeper")).toBe(true);
    expect(canHaul("sweeper")).toBe(false);
    expect(canClean("hauler")).toBe(false);
    expect(canHaul("hauler")).toBe(true);
    // 一个人玩的时候不分工,两样都能做
    expect(roleOf(def, 0, 1)).toBe("solo");
    expect(canClean("solo") && canHaul("solo")).toBe(true);
    const w = createWorld(def, 2);
    expect(w.players.map((p) => p.role)).toEqual(["sweeper", "hauler"]);
  });

  it("两个人一起打,前 8 张合作图都拿得到三星", () => {
    for (let r = 0; r < 8; r++) {
      const def = buildCoop(r);
      const w = botRun(def, 2);
      const summary = summarize(w);
      expect(w.status, `合作第 ${r + 1} 关没打通`).toBe("won");
      expect(summary.sorted, `合作第 ${r + 1} 关搬运没达标`).toBeGreaterThanOrEqual(def.haulGoal);
      expect(coopStars(def, summary), `合作第 ${r + 1} 关该给三星`).toBe(3);
    }
  });

  it("只有一个人动手就拿不到三星:搬运那一条只有同伴做得到", () => {
    for (let r = 0; r < 4; r++) {
      const def = buildCoop(r);
      const w = createWorld(def, 2);
      // 1 号玩家全程不动,只让清扫员一个人跑
      for (let i = 0; i < 60 * 150 && w.status === "playing"; i++) {
        stepWorld(w, 1 / 60, [botInput(w, 0), emptyInput()]);
      }
      const summary = summarize(w);
      expect(summary.sorted, `合作第 ${r + 1} 关:清扫员搬不动垃圾`).toBe(0);
      expect(w.litters.every((l) => !l.sorted)).toBe(true);
      expect(coopStars(def, summary), `合作第 ${r + 1} 关:一个人最多两星`).toBeLessThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// 六、无尽「打扫不完的城市」
// ---------------------------------------------------------------------------

describe("poop-hero 1.2 · 打扫不完的城市", () => {
  it("街区由 2–4 个区块随机拼接,相邻不重样,同一段每次拼出来都一样", () => {
    for (let r = 0; r < 24; r++) {
      const plan = endlessBlockPlan(r);
      expect(plan.length).toBeGreaterThanOrEqual(2);
      expect(plan.length).toBeLessThanOrEqual(4);
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i], `第 ${r + 1} 段相邻区块重样了`).not.toBe(plan[i - 1]);
      }
      expect(endlessBlockPlan(r)).toEqual(plan);
    }
    // 越往后拼得越长
    expect(endlessBlockPlan(0).length).toBeLessThan(endlessBlockPlan(9).length);
    const def = buildEndless(3);
    expect(def.blocks.length).toBe(endlessBlockPlan(3).length);
    for (const name of def.blocks) expect(def.name).toContain(name);
  });

  it("脏乱度一段比一段涨得快,但永远给得起边清边压的余地", () => {
    let prev = -1;
    for (let r = 0; r < 30; r++) {
      const rate = messRateFor(r);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(0.03);
      expect(rate).toBeGreaterThanOrEqual(prev);
      prev = rate;
      expect(buildEndless(r).messRate).toBe(rate);
    }
    // 涨得再快也要 30 秒以上才涨满,够跑完一段街区
    expect(1 / messRateFor(29)).toBeGreaterThan(30);
  });

  it("脏乱度曲线:光跑就往上涨,清一处就往回退,永远夹在 0..1", () => {
    expect(messAfter(0.5, 0.02, 10)).toBeCloseTo(0.7, 6);
    expect(messAfter(0.5, 0.02, 10, 4)).toBeLessThan(messAfter(0.5, 0.02, 10));
    expect(messAfter(0.02, 0, 0, 40)).toBe(0);
    expect(messAfter(0.95, 0.2, 10)).toBe(1);
  });

  it("脏乱度涨满这一趟就结束,而且说的是「明天接着来」不是骂人", () => {
    const w = createWorld({ ...buildEndless(0), messRate: 0.5 }, 1);
    hold(w, emptyInput(), 4);
    expect(w.status).toBe("lost");
    expect(w.mess).toBe(1);
    expect(w.message).toContain("明天接着来");
    for (const bad of BANNED_WORDS) expect(w.message.includes(bad)).toBe(false);
  });

  it("清掉脏东西能把脏乱度压回去", () => {
    const base = buildEndless(0);
    const def: LevelDef = {
      ...base,
      messRate: 0.1,
      gaps: [],
      monsters: [],
      sludges: [],
      junks: [],
      chaserSpeed: null,
      stains: [{ x: 120 }],
    };
    const w = createWorld(def, 1);
    hold(w, emptyInput(), 2);
    const before = w.mess;
    expect(before).toBeGreaterThan(0.15);
    // 站到污渍旁边扫一下
    w.players[0].x = 120;
    hold(w, press({ sub: true }), 0.1);
    expect(w.cleaned).toBe(1);
    expect(w.mess, "清一处应该把脏乱度压回去一截").toBeLessThan(before);
  });
});

// ---------------------------------------------------------------------------
// 七、手机布局与 destroy 归零
// ---------------------------------------------------------------------------

describe("poop-hero 1.2 · 360px 手机与资源回收", () => {
  it("360px 单人:热区不小于 44px,摇杆和清扫钮永远隔着一个 gap", () => {
    for (const width of [320, 360, 390, 414]) {
      const m = padMetrics(width, 1);
      expect(m.key, `${width}px 上热区太小`).toBeGreaterThanOrEqual(MIN_HOT);
      expect(padOverlaps(m), `${width}px 上摇杆和清扫钮叠住了`).toBe(false);
      expect(m.actionLeft - m.joystickRight).toBe(m.gap);
    }
  });

  it("双人分屏两个摇杆并排也不重叠,而且塞得进 360px", () => {
    const m = padMetrics(360, 2);
    expect(padOverlaps(m)).toBe(false);
    expect(m.key).toBeGreaterThanOrEqual(MIN_HOT_DUO);
    expect(m.totalWidth).toBeLessThanOrEqual(360);
    // 拿不到视口宽度时按 360px 兜底,不会算出 0 或负数
    expect(padMetrics(Number.NaN, 1).key).toBeGreaterThanOrEqual(MIN_HOT);
    expect(padMetrics(0, 1).key).toBeGreaterThanOrEqual(MIN_HOT);
  });

  it("destroy 一把归零:rAF、定时器、监听一个都不剩,再调一次也不出事", () => {
    const cancelled: number[] = [];
    const cleared: number[] = [];
    const bag = createDisposer({ cancelRaf: (id) => cancelled.push(id), clearTimer: (id) => cleared.push(id) });
    const off: string[] = [];
    const target = {
      addEventListener(): void {
        /* 挂上就行 */
      },
      removeEventListener(type: string): void {
        off.push(type);
      },
    };
    bag.raf(7);
    bag.timer(11);
    bag.timer(12);
    bag.listen(target, "keydown", () => undefined);
    bag.listen(target, "pointerup", () => undefined);
    expect(bag.size).toBe(5);
    bag.dispose();
    expect(bag.disposed).toBe(true);
    expect(bag.size).toBe(0);
    expect(cancelled).toEqual([7]);
    expect(cleared).toEqual([11, 12]);
    expect(off).toEqual(["keydown", "pointerup"]);
    bag.dispose();
    expect(cancelled).toEqual([7]);
    // 归零之后再登记也不会又攒起来
    bag.raf(99);
    bag.timer(99);
    expect(bag.size).toBe(0);
  });

  it("主循环每帧登记 rAF 只留最新的一个,不会越攒越多", () => {
    const cancelled: number[] = [];
    const bag = createDisposer({ cancelRaf: (id) => cancelled.push(id) });
    for (let frame = 1; frame <= 600; frame++) bag.raf(frame);
    expect(bag.size).toBe(1);
    bag.dispose();
    expect(cancelled).toEqual([600]);
  });

  it("?level=N 与壳层的 initialLevel 都能直开第 N 关,越界会夹回来", () => {
    expect(parseLevelParam("?level=12")).toBe(12);
    expect(parseLevelParam("#/game?level=7&mode=x")).toBe(7);
    expect(parseLevelParam("?mode=coop")).toBeNull();
    expect(parseLevelParam("")).toBeNull();
    // 1 基进、0 基出
    expect(resolveInitialLevel(1, 187)).toBe(0);
    expect(resolveInitialLevel("12", 187)).toBe(11);
    expect(resolveInitialLevel(999, 187)).toBe(187);
    expect(resolveInitialLevel(-4, 187)).toBe(0);
    // 还没解锁的关退回到当前能玩到的最远那一关
    expect(resolveInitialLevel(150, 20)).toBe(20);
    expect(resolveInitialLevel(undefined, 20)).toBeNull();
    expect(resolveInitialLevel("随便写的", 20)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 八、回归:前 99 关一个数都没动 + 新关卡照样打得通
// ---------------------------------------------------------------------------

describe("poop-hero 1.2 · 不许倒退", () => {
  it("前 99 关的几何与数值和 1.1 完全一致(摘要钉死)", () => {
    // 摘要是拿 1.1 的 buildLevel 逐关对过一遍才钉进来的:
    // 只要有人不小心动了前 99 关的随机序列或数值,这里立刻变色。
    const digest = fnv1a(
      Array.from({ length: MISSION_FROM_LEVEL }, (_, i) => geometryDigest(buildLevel(i))).join("|")
    );
    expect(digest).toBe("4b105123");
  });

  it("新任务关抽样都打得通,而且都压得进时间上限", () => {
    const picks = [99, 100, 101, 102, 103, 104, 130, 145, 160, 179, TOTAL - 1];
    for (const lv of picks) {
      const def = buildLevel(lv);
      const w = botRun(def);
      expect(w.status, `第 ${lv + 1} 关(${def.name} · ${def.mission})打不通`).toBe("won");
      if (def.timeLimit > 0) expect(w.time).toBeLessThan(def.timeLimit);
      if (def.cart) expect(cartDelivered(w)).toBe(true);
    }
  });

  it("1.2 新写的文案一样守红线:没有商标,没有低俗字眼", () => {
    const texts = [
      ...TRASH_ITEMS.map((t) => `${t.name}${t.why}`),
      ...BINS.map((b) => `${b.name}${b.hint}`),
      ...HYGIENE_TIPS,
      ...Object.values(MISSION_INFO).map((m) => `${m.label}${m.hint}`),
      ...Array.from({ length: 8 }, (_, r) => {
        const d = buildCoop(r);
        return `${d.name}${d.hint}${d.feature}`;
      }),
      ...Array.from({ length: 8 }, (_, r) => {
        const d = buildEndless(r);
        return `${d.name}${d.hint}${d.feature}`;
      }),
      ...Array.from({ length: 40 }, (_, i) => {
        const d = buildLevel(MISSION_FROM_LEVEL + i);
        return `${d.name}${d.hint}${d.feature}`;
      }),
    ];
    for (const text of texts) {
      for (const bad of BANNED_WORDS) {
        expect(text.includes(bad), `「${bad}」出现在:${text}`).toBe(false);
      }
      for (const mark of TRADEMARKS) {
        expect(text.includes(mark), `蹭到商标「${mark}」:${text}`).toBe(false);
      }
    }
  });
});
