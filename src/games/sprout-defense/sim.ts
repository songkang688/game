// 绿芽保卫战 1.2 —— 无头模拟器:用一套固定(确定性)策略把一关从头打到尾,
// 验证 188 关的资源曲线可通关、不是死局,顺带验证「稳扎稳打」和「速攻」两种流派都活得下去。
// 只依赖 logic.ts / sprout12.ts,不碰 DOM。
//
// 规则与 index.ts 运行时逐条对齐:出虫时间表、露珠与阳光两条经济、一苗一档的射速与冷却、
// 冰冻、溅射、爆爆果、跳跃与弹弹网、哧溜虫挖地绕后、荷叶,以及 1.1 的昼夜 / 地下虫 /
// 露珠上限 / 分裂 / 进化体;1.2 的三种特殊关(解谜 / 传送 / 速攻)和无尽「守到天亮」。

import {
  BLITZ_GRACE,
  BOOM_DAMAGE,
  BOOM_RANGE,
  BOOM_TRIGGER,
  BOSS_CHEW_INTERVAL,
  BELT_EVERY,
  BELT_QUEUE_MAX,
  BUBBLE_SPEED,
  BUG_INFO,
  BUG_SPAWN_X,
  BugKind,
  BugSpawn,
  CHEW_INTERVAL,
  DayNightCycle,
  HOME_X,
  ICE_SECONDS,
  ICE_SLOW,
  ICE_SPEED,
  LANES,
  LEVELS,
  MAMA_SPLIT_KIND,
  MOON_DEW_EVERY,
  PLANT_COLS,
  PLANT_INFO,
  PUFF_SPEED,
  PUFF_SPLASH_DAMAGE,
  PUFF_SPLASH_RANGE,
  PlantKind,
  PlantStock,
  ProjKind,
  SCENE_STYLE,
  SPARKLE_DEW_EVERY,
  STAR_SPEED,
  SceneId,
  SpecialSpec,
  TUNNEL_EXIT_COL,
  TUNNEL_TIME,
  applyDamage,
  bubbleHitsBug,
  bugHp,
  bugNightSpeedMult,
  bugReachesPlant,
  buildLevelSchedule,
  canJumpOver,
  clampDew,
  cyclePhase,
  effectiveDewCap,
  moleRevealed,
  moonActive,
  passiveDewIntervalAt,
  plantsUnlockedAt,
  projectileCanHit,
  queenxSpeedMult,
  shootCooldown,
  tunnelExitCol,
} from "./logic";
import {
  PLANT_SPEC,
  SUN_FIRST,
  buildEndlessSchedule,
  endlessWave,
  sunInterval,
} from "./sprout12";

interface SimPlant {
  kind: PlantKind;
  col: number;
  lane: number;
  hp: number;
  cd: number;
  prodTimer: number;
}

interface SimBug {
  kind: BugKind;
  x: number;
  lane: number;
  hp: number;
  maxHp: number;
  armor: number;
  speed: number;
  freeze: number;
  chewTimer: number;
  jumped: boolean;
  /** 挖地剩余秒数;> 0 时在土里,打不到也不啃 */
  dig: number;
}

interface SimShot {
  x: number;
  lane: number;
  proj: ProjKind;
}

export interface SimResult {
  win: boolean;
  time: number;
  breachLane: number;
  breachKind: BugKind | null;
  dewEarned: number;
  dewSpent: number;
  sunEarned: number;
  plantsBuilt: number;
  plantsLost: number;
  bugsKilled: number;
  /** 速攻关:倒计时到了还没清场 */
  timedOut: boolean;
  /** 无尽:撑过了几波 */
  wavesSurvived: number;
  trace: string[];
}

/** 两种流派 + 默认的中庸打法。 */
export type SimStyle = "balanced" | "steady" | "rush";

export interface SimOptions {
  /** false = 什么都不种(用来验证 BOSS 关也能打输) */
  build?: boolean;
  trace?: boolean;
  /** 打法:steady = 稳扎稳打先铺经济,rush = 速攻先堆枪 */
  style?: SimStyle;
  /** 只准种这几种苗(验证「没有万能苗」) */
  onlyPlants?: PlantKind[];
}

const CDS = Number(process.env.SPD_CD ?? 1);
const CDONLY = process.env.SPD_CD_ONLY;
const WANT4 = Number(process.env.SPD_W4 ?? 55);
const WANT3 = Number(process.env.SPD_W3 ?? 28);
const WANT2 = Number(process.env.SPD_W2 ?? 8);
const cdOf = (k: PlantKind): number =>
  CDONLY ? (CDONLY.split(",").includes(k) ? PLANT_SPEC[k].cooldown : 0) : PLANT_SPEC[k].cooldown * CDS;
const DT = 1 / 30;
const DECIDE_EVERY = 0.25;

interface Tuning {
  /** 经济苗种到几棵 */
  ecoTarget: number;
  /** 打仗时手里留几滴应急 */
  reserve: number;
  /** 火力升级的威胁门槛倍率(越小越早加枪) */
  gunEager: number;
}

const TUNING: Record<SimStyle, Tuning> = {
  balanced: { ecoTarget: 5, reserve: 2, gunEager: 1 },
  steady: { ecoTarget: 7, reserve: 3, gunEager: 1.25 },
  rush: { ecoTarget: 2, reserve: 1, gunEager: 0.7 },
};

interface SimSetup {
  scene: SceneId;
  waterLanes: number[];
  startDew: number;
  cycle?: DayNightCycle;
  dewCap?: number;
  special?: SpecialSpec;
  schedule: BugSpawn[];
  unlocked: Set<PlantKind>;
  /** 血量曲线用的关号(无尽用等效关号) */
  hpLevel: number;
  /** 开局白送的阳光 */
  startSun?: number;
  /** 无尽:第几波额外加多少血 */
  hpBonusOfWave?: (wave: number) => number;
  /** 速攻关的倒计时 */
  timeLimit?: number;
  /** 无尽:跑到这一波就算「验证够了」 */
  endless?: boolean;
  totalWaves: number;
}

const isShooterKind = (k: PlantKind): boolean =>
  k === "bubble" || k === "star" || k === "ice" || k === "puff";

const projOf = (k: PlantKind): ProjKind => k as ProjKind;

function runSim(setup: SimSetup, opts: SimOptions): SimResult {
  const build = opts.build !== false;
  const tuning = TUNING[opts.style ?? "balanced"];
  const st = SCENE_STYLE[setup.scene];
  const schedule = setup.schedule;
  const unlocked = new Set(setup.unlocked);
  if (opts.onlyPlants) {
    for (const k of [...unlocked]) if (!opts.onlyPlants.includes(k)) unlocked.delete(k);
  }
  const special = setup.special;
  const puzzle = special?.kind === "puzzle";
  const conveyor = special?.kind === "conveyor";
  const maxTime = setup.timeLimit ?? (schedule[schedule.length - 1]?.time ?? 0) + 300;

  const plants = new Map<string, SimPlant>();
  const lilies = new Set<string>();
  const bugs: SimBug[] = [];
  const shots: SimShot[] = [];
  const cardCd = new Map<PlantKind, number>();
  const stock = new Map<PlantKind, number>();
  for (const s of (special?.stock ?? []) as PlantStock[]) stock.set(s.kind, s.count);
  const belt: PlantKind[] = special?.belt ? [...special.belt] : [];
  const beltEvery = special?.beltEvery ?? BELT_EVERY;
  let beltIdx = 0;
  let beltTimer = beltEvery;
  const queue: PlantKind[] = [];
  // 开局先塞两张卡进队列,不用干等第一趟传送带
  for (let i = 0; i < 2 && belt.length > 0; i++) queue.push(belt[beltIdx++ % belt.length]);

  let dew = puzzle ? 0 : setup.startDew;
  let sun = setup.startSun ?? 0;
  let time = 0;
  let spawnIdx = 0;
  let passiveTimer = passiveDewIntervalAt(setup.scene, false);
  let decideTimer = 0.5;
  let dewEarned = 0;
  let dewSpent = 0;
  let sunEarned = 0;
  let plantsBuilt = 0;
  let plantsLost = 0;
  let bugsKilled = 0;
  let wavesSurvived = 0;
  const trace: string[] = [];
  const log = (s: string): void => {
    if (opts.trace) trace.push(`t=${time.toFixed(1)} ${s}`);
  };

  const hpOf = (kind: BugKind, wave: number): number =>
    bugHp(kind, setup.hpLevel) + (setup.hpBonusOfWave?.(wave) ?? 0);

  /* ---------- 关卡情报(固定策略允许读关卡定义,策略本身是确定性的) ---------- */
  const laneArrivals: Array<Array<{ time: number; kind: BugKind; wave: number }>> = Array.from(
    { length: LANES },
    () => [],
  );
  for (const s of schedule) laneArrivals[s.lane].push({ time: s.time, kind: s.kind, wave: s.wave });
  const laneHasFlyer = laneArrivals.map((a) => a.some((e) => BUG_INFO[e.kind].flying));
  const laneHasMole = laneArrivals.map((a) => a.some((e) => BUG_INFO[e.kind].underground));
  const laneHasFast = laneArrivals.map((a) =>
    a.some((e) => BUG_INFO[e.kind].speed * st.speedMult >= 0.85 || BUG_INFO[e.kind].nightMult),
  );
  const laneHasBoss = laneArrivals.map((a) => a.some((e) => BUG_INFO[e.kind].boss));

  const key = (col: number, lane: number): string => `${col},${lane}`;
  const producerCount = (): number =>
    [...plants.values()].filter((p) => p.kind === "sparkle" || p.kind === "moon").length;
  const gainDew = (n: number): void => {
    if (puzzle || conveyor) return; // 特殊关不吃露珠经济
    dew = clampDew(dew + n, effectiveDewCap(setup.dewCap, producerCount()));
    dewEarned += n;
  };

  const scoutAlive: boolean[] = new Array(LANES).fill(false);
  const netpadCols: number[][] = Array.from({ length: LANES }, () => []);
  const refreshLaneAids = (): void => {
    scoutAlive.fill(false);
    for (let l = 0; l < LANES; l++) netpadCols[l].length = 0;
    for (const p of plants.values()) {
      if (p.kind === "scout") scoutAlive[p.lane] = true;
      if (p.kind === "netpad") netpadCols[p.lane].push(p.col);
    }
  };
  const revealed = (b: SimBug): boolean => moleRevealed(b.kind, scoutAlive[b.lane]) && b.dig <= 0;

  const cardReady = (kind: PlantKind): boolean => (cardCd.get(kind) ?? 0) <= 0;

  /** 手里的资源够不够买这一株(特殊关看库存/传送带,普通关看露珠+阳光)。 */
  function affordable(kind: PlantKind): boolean {
    if (puzzle) return (stock.get(kind) ?? 0) > 0;
    if (conveyor) return queue.includes(kind);
    return dew >= PLANT_INFO[kind].cost && sun >= PLANT_SPEC[kind].sun;
  }

  function pay(kind: PlantKind): void {
    if (puzzle) {
      stock.set(kind, (stock.get(kind) ?? 0) - 1);
      return;
    }
    if (conveyor) {
      const i = queue.indexOf(kind);
      if (i >= 0) queue.splice(i, 1);
      return;
    }
    dew -= PLANT_INFO[kind].cost;
    dewSpent += PLANT_INFO[kind].cost;
    sun -= PLANT_SPEC[kind].sun;
  }

  /**
   * 高优先级买不起的时候该不该「攒钱等」。
   * 只有普通关、而且卡在露珠上才值得等 —— 露珠会自己长出来;
   * 阳光要靠暖暖花现开,特殊关的库存/传送带更是干等也不会变多,那就往下办别的事。
   */
  function worthWaiting(kind: PlantKind): boolean {
    if (puzzle || conveyor) return false;
    if (sun < PLANT_SPEC[kind].sun) return false;
    return dew < PLANT_INFO[kind].cost;
  }

  /** 特殊关手里没这一种就换一种能种的(普通关照原样)。 */
  function pickAvailable(want: PlantKind, alts: PlantKind[]): PlantKind {
    if (!(puzzle || conveyor) || affordable(want)) return want;
    return alts.find((k) => unlocked.has(k) && affordable(k)) ?? want;
  }

  function buy(kind: PlantKind, col: number, lane: number): boolean {
    if (col < 0 || col > PLANT_COLS - 1) return false;
    if (!unlocked.has(kind) || !cardReady(kind) || !affordable(kind)) return false;
    const k = key(col, lane);
    const water = setup.waterLanes.includes(lane);
    if (water && !lilies.has(k)) {
      if (!unlocked.has("lily") || !cardReady("lily") || !affordable("lily")) return false;
      pay("lily");
      cardCd.set("lily", PLANT_SPEC.lily.cooldown);
      lilies.add(k);
      log(`铺荷叶 (${col},${lane})`);
      return true;
    }
    if (plants.has(k)) return false;
    pay(kind);
    cardCd.set(kind, PLANT_SPEC[kind].cooldown);
    plants.set(k, {
      kind,
      col,
      lane,
      hp: PLANT_INFO[kind].hp,
      cd: 0.5,
      prodTimer:
        kind === "moon" ? MOON_DEW_EVERY : kind === "sunbud" ? SUN_FIRST : SPARKLE_DEW_EVERY,
    });
    plantsBuilt++;
    log(`种 ${PLANT_INFO[kind].name} (${col},${lane}) 剩💧${dew} ☀️${sun}`);
    if (kind === "scout" || kind === "netpad") refreshLaneAids();
    return true;
  }

  const shootersIn = (lane: number): SimPlant[] =>
    [...plants.values()].filter((p) => p.lane === lane && isShooterKind(p.kind));
  const hasKindIn = (lane: number, kind: PlantKind): boolean =>
    [...plants.values()].some((p) => p.lane === lane && p.kind === kind);
  const plantsInLane = (lane: number): number =>
    [...plants.values()].filter((p) => p.lane === lane).length;
  const sunbudCount = (): number =>
    [...plants.values()].filter((p) => p.kind === "sunbud").length;

  /** 车道剩余威胁:场上活虫 + 还没出场的虫的(血+甲)总和。 */
  function laneThreat(lane: number): number {
    let s = 0;
    for (const b of bugs) if (b.lane === lane) s += b.hp + b.armor;
    for (let i = spawnIdx; i < schedule.length; i++) {
      if (schedule[i].lane === lane) {
        s += hpOf(schedule[i].kind, schedule[i].wave) + BUG_INFO[schedule[i].kind].armor;
      }
    }
    return s;
  }
  function moleSoon(lane: number): boolean {
    for (const b of bugs) if (b.lane === lane && BUG_INFO[b.kind].underground) return true;
    for (let i = spawnIdx; i < schedule.length; i++) {
      const s = schedule[i];
      if (s.lane === lane && BUG_INFO[s.kind].underground && s.time <= time + 12) return true;
    }
    return false;
  }
  /** 这条道上有没有挖地的虫已经在钻 / 马上要来。 */
  function diggerSoon(lane: number, horizon: number): boolean {
    for (const b of bugs) if (b.lane === lane && BUG_INFO[b.kind].digs) return true;
    for (let i = spawnIdx; i < schedule.length; i++) {
      const s = schedule[i];
      if (s.lane === lane && BUG_INFO[s.kind].digs && s.time <= time + horizon) return true;
    }
    return false;
  }
  /** 虫子前方(含正在啃的)剩余"啃食拖延时间"(秒)。 */
  function stallAhead(bug: SimBug): number {
    const per = BUG_INFO[bug.kind].boss ? BOSS_CHEW_INTERVAL : CHEW_INTERVAL;
    let s = 0;
    for (const p of plants.values()) {
      if (p.lane === bug.lane && bug.x >= p.col - 0.1) s += p.hp * per;
    }
    return s;
  }
  /** 只算挡路苗的拖延时间:炮和经济苗不该拿去喂虫,墙要及时立。 */
  function wallStallAhead(bug: SimBug): number {
    const per = BUG_INFO[bug.kind].boss ? BOSS_CHEW_INTERVAL : CHEW_INTERVAL;
    let s = 0;
    for (const p of plants.values()) {
      if (
        (p.kind === "nut" || p.kind === "netpad") &&
        p.lane === bug.lane &&
        bug.x >= p.col - 0.1
      ) {
        s += p.hp * per;
      }
    }
    return s;
  }

  const shooterCols = (lane: number): number[] => (laneHasMole[lane] ? [2, 3, 4] : [1, 2, 3]);
  const wallCol = 6;
  /** 这一关要不要开阳光线:有挖地的虫就得靠弹弹网,弹弹网吃阳光。 */
  const digLanes = laneArrivals.filter((a) => a.some((e) => BUG_INFO[e.kind].digs)).length;
  const needSun =
    !puzzle && !conveyor && digLanes > 0 && unlocked.has("netpad") && PLANT_SPEC.netpad.sun > 0;
  const sunbudWant = digLanes >= 3 ? 2 : 1;
  const moonBetter = unlocked.has("moon") && !setup.cycle && st.dark;
  const ecoTarget = tuning.ecoTarget + (st.dewMult >= 1.3 ? 1 : 0);

  function rusherSoon(lane: number, horizon: number): boolean {
    return (
      bugs.some((b) => b.lane === lane && BUG_INFO[b.kind].speed * st.speedMult >= 1.15) ||
      laneArrivals[lane].some(
        (e) =>
          BUG_INFO[e.kind].speed * st.speedMult >= 1.15 &&
          e.time >= time &&
          e.time <= time + horizon,
      )
    );
  }
  /** 车道首选炮:飞虫快到了才上星星(贵);狂飙的快到了才上冰冰花;其余泡泡。 */
  function firstShooterKind(lane: number): PlantKind {
    const flyerSoon =
      bugs.some((b) => b.lane === lane && BUG_INFO[b.kind].flying) ||
      laneArrivals[lane].some(
        (e) => BUG_INFO[e.kind].flying && e.time >= time && e.time <= time + 20,
      );
    if (flyerSoon && unlocked.has("star")) return pickAvailable("star", ["ice", "bubble", "puff"]);
    if (rusherSoon(lane, 12) && unlocked.has("ice") && !hasKindIn(lane, "ice")) {
      return pickAvailable("ice", ["star", "bubble", "puff"]);
    }
    if (unlocked.has("bubble")) return pickAvailable("bubble", ["star", "ice", "puff"]);
    return [...unlocked].find((k) => isShooterKind(k)) ?? "bubble";
  }

  function cellSafe(col: number, lane: number): boolean {
    return !bugs.some(
      (b) =>
        b.lane === lane &&
        !BUG_INFO[b.kind].flying &&
        revealed(b) &&
        b.x > col - 0.15 &&
        b.x < col + 2.3,
    );
  }
  function laneUrgency(lane: number): number {
    let u = Infinity;
    for (let i = spawnIdx; i < schedule.length; i++) {
      const s = schedule[i];
      if (s.lane !== lane) continue;
      const speed = BUG_INFO[s.kind].speed * st.speedMult;
      u = Math.min(u, s.time + (BUG_SPAWN_X - HOME_X) / Math.max(0.1, speed));
    }
    for (const b of bugs) {
      if (b.lane !== lane) continue;
      u = Math.min(u, time + Math.max(0, b.x - HOME_X) / Math.max(0.1, b.speed) + stallAhead(b));
    }
    return u;
  }
  const safeFreeCol = (lane: number, prefer: number[]): number => {
    for (const c of prefer) if (!plants.has(key(c, lane)) && cellSafe(c, lane)) return c;
    return -1;
  };
  const shooterKind = (lane: number): PlantKind =>
    laneHasFlyer[lane] && unlocked.has("star")
      ? pickAvailable("star", ["ice", "bubble", "puff"])
      : firstShooterKind(lane);

  const wallKind = (): PlantKind =>
    unlocked.has("nut") ? pickAvailable("nut", ["netpad"]) : "netpad";

  /**
   * 固定策略的一步:按优先级找到第一件该办的事,办成返回 true。
   * 高优先级(望望草 / 每道第一门炮 / 应急墙)缺钱时会"攒钱等",不让低优先级抢预算;
   * 但只要是卡在冷却上,就往下顺一位办别的事,别干等着。
   */
  function step(): boolean {
    // P1 应急:地面虫快漏进小屋且前方拖不住。
    const endangered = bugs
      .filter(
        (b) =>
          !BUG_INFO[b.kind].flying && revealed(b) && b.x < 4.5 && b.x > 0.8 && stallAhead(b) < 2.6,
      )
      .sort((a, b2) => a.x - b2.x);
    for (const b of endangered) {
      const wall = wallKind();
      const cNut = Math.min(5, Math.floor(b.x - 0.7));
      for (let c = cNut; c >= 0; c--) {
        if (!plants.has(key(c, b.lane))) {
          if (unlocked.has(wall) && cardReady(wall) && worthWaiting(wall)) return false; // 攒钱救急
          if (buy(wall, c, b.lane)) return true;
          break;
        }
      }
      const gunsBehind = shootersIn(b.lane).filter((p) => p.col + 0.3 < b.x).length;
      if (gunsBehind === 0) {
        const gun = firstShooterKind(b.lane);
        for (let c = Math.max(0, Math.floor(b.x - 0.5)); c >= 0; c--) {
          if (!plants.has(key(c, b.lane)) && buy(gun, c, b.lane)) return true;
        }
      }
    }
    // P2 望望草:地下虫将至的车道,一道一棵,倒了就补。
    if (unlocked.has("scout")) {
      for (let lane = 0; lane < LANES; lane++) {
        if (!moleSoon(lane) || scoutAlive[lane]) continue;
        const c = safeFreeCol(lane, [0, 1, 2, 3, 4, 5, 6, 7]);
        if (c < 0) continue;
        if (cardReady("scout") && worthWaiting("scout")) return false; // 攒钱等望望草
        if (buy("scout", c, lane)) return true;
      }
    }
    // P3 每道第一门炮(按紧迫度排序)
    const laneOrder = [0, 1, 2, 3].sort((a, b2) => laneUrgency(a) - laneUrgency(b2));
    for (const lane of laneOrder) {
      if (laneThreat(lane) <= 0 || shootersIn(lane).length >= 1) continue;
      if (laneUrgency(lane) > time + 25) continue;
      const kind = firstShooterKind(lane);
      const c = safeFreeCol(lane, shooterCols(lane));
      if (c < 0) continue;
      if (cardReady(kind) && worthWaiting(kind)) return false; // 攒钱等第一门炮
      if (buy(kind, c, lane)) return true;
    }
    // P3.5 防空:飞虫拦不了墙,快到的车道必须有一门打得着天上的炮
    if (unlocked.has("star")) {
      for (const lane of laneOrder) {
        const flyerSoon =
          bugs.some((b) => b.lane === lane && BUG_INFO[b.kind].flying) ||
          laneArrivals[lane].some(
            (e) => BUG_INFO[e.kind].flying && e.time >= time && e.time <= time + 15,
          );
        if (!flyerSoon) continue;
        if (shootersIn(lane).some((p) => p.kind === "star" || p.kind === "ice")) continue;
        const c = safeFreeCol(lane, shooterCols(lane).concat([4, 0]));
        if (c < 0) continue;
        if (cardReady("star") && worthWaiting("star")) return false; // 攒钱等防空炮
        if (buy("star", c, lane)) return true;
      }
    }
    // P4 城墙:有炮的车道,地面威胁扛不住就在虫前立墙;狂飙车道预立。
    for (const lane of laneOrder) {
      if (shootersIn(lane).length === 0) continue;
      const wall = wallKind();
      const ground = bugs.filter(
        (b) => b.lane === lane && !BUG_INFO[b.kind].flying && revealed(b) && b.x > 1.4,
      );
      if (ground.length === 0) {
        if (rusherSoon(lane, 10) && !plants.has(key(wallCol, lane))) {
          if (buy(wall, wallCol, lane)) return true;
        }
        continue;
      }
      const front = ground.sort((a, b2) => a.x - b2.x)[0];
      const hpSum = ground.reduce((s, b) => s + b.hp + b.armor, 0);
      const dps = shootersIn(lane).reduce(
        (s, p) => s + 1 / shootCooldown(projOf(p.kind)),
        0,
      );
      const tReach = (front.x - 1.6) / Math.max(0.1, front.speed) + wallStallAhead(front);
      if (hpSum > dps * tReach && front.x < 7.9 && wallStallAhead(front) < 5) {
        const c = Math.min(wallCol, Math.floor(front.x - 0.8));
        if (c >= 1 && !plants.has(key(c, lane))) {
          if (unlocked.has(wall) && cardReady(wall) && worthWaiting(wall)) return false; // 攒钱等墙
          if (buy(wall, c, lane)) return true;
        }
      }
    }
    // P5 爆爆果:墙前一坨厚虫(或 BOSS 压阵)→ 贴虫前埋一颗
    if (unlocked.has("boom")) {
      for (let lane = 0; lane < LANES; lane++) {
        const inLane = bugs.filter((b) => b.lane === lane && b.x < 7.6 && b.x > 1.3 && revealed(b));
        if (inLane.length === 0) continue;
        const front = Math.min(...inLane.map((b) => b.x));
        const c = Math.max(0, Math.min(7, Math.floor(front - 0.75)));
        const cluster = bugs.filter(
          (b) => Math.abs(b.lane - lane) <= 1 && revealed(b) && b.x > c - 1.1 && b.x < c + 3.4,
        );
        const hpSum = cluster.reduce((s, b) => s + b.hp + b.armor, 0);
        const hasBoss = cluster.some((b) => BUG_INFO[b.kind].boss);
        if (hpSum < 14 && !hasBoss) continue;
        const boomNearby = [...plants.values()].some(
          (p) => p.kind === "boom" && p.lane === lane && Math.abs(p.col - c) <= 1,
        );
        if (boomNearby) continue;
        for (let cc = c; cc >= Math.max(0, c - 2); cc--) {
          if (!plants.has(key(cc, lane)) && buy("boom", cc, lane)) return true;
        }
      }
    }
    // 打仗时手里留几滴应急,非紧急购买不许花光
    const reserve = bugs.some((b) => b.x < 6.5) ? tuning.reserve : 0;
    const buyBg = (kind: PlantKind, col: number, lane: number): boolean =>
      (puzzle || conveyor || dew >= PLANT_INFO[kind].cost + reserve) && buy(kind, col, lane);
    // P5.5 阳光准备:这一关要用吃阳光的苗(弹弹网防挖地),就得提前把暖暖花种上 ——
    // 阳光只能现开,临阵磨枪来不及;但排在炮和墙后面,不许抢救命的预算。
    if (needSun && unlocked.has("sunbud") && sunbudCount() < sunbudWant) {
      for (const lane of [0, 1, 2, 3]) {
        const c = safeFreeCol(lane, [0, 1]);
        if (c < 0) continue;
        if (buyBg("sunbud", c, lane)) return true;
        break;
      }
    }
    // P5.6 弹弹网:挖地的哧溜虫要来了,提前在第 4 列铺网 ——
    // 网底下钻不过去,它只能在网前面冒头,正好撞在自家炮口上。
    if (unlocked.has("netpad")) {
      for (let lane = 0; lane < LANES; lane++) {
        if (!diggerSoon(lane, 30) || netpadCols[lane].some((c) => c >= TUNNEL_EXIT_COL)) continue;
        const c = safeFreeCol(lane, [4, 5, 3, 6]);
        if (c < 0) continue;
        if (buyBg("netpad", c, lane)) return true;
      }
    }
    // P6 经济:闪光芽 1 珠 4.5 秒回本,猛攒到目标棵数
    if (!puzzle && !conveyor && producerCount() < ecoTarget) {
      const ecoLanes = [0, 1, 2, 3]
        .filter((l) => !setup.waterLanes.includes(l))
        .sort((a, b2) => laneUrgency(b2) - laneUrgency(a));
      for (const lane of ecoLanes.length > 0 ? ecoLanes : [0, 1, 2, 3]) {
        for (const c of [0, 1]) {
          if (!plants.has(key(c, lane)) && cellSafe(c, lane)) {
            if (buyBg(moonBetter ? "moon" : "sparkle", c, lane)) return true;
            break;
          }
        }
      }
    }
    // P7 火力升级:炮数跟着车道剩余威胁走
    const byThreat = [0, 1, 2, 3].sort((a, b2) => laneThreat(b2) - laneThreat(a));
    for (let d = 2; d <= 4; d++) {
      for (const lane of byThreat) {
        const threat = laneThreat(lane) / tuning.gunEager;
        const want = threat >= 55 ? 4 : threat >= 28 ? 3 : threat >= 8 ? 2 : 1;
        if (want < d || shootersIn(lane).length !== d - 1) continue;
        let kind: PlantKind;
        if (laneHasFast[lane] && unlocked.has("ice") && !hasKindIn(lane, "ice")) kind = "ice";
        else kind = shooterKind(lane);
        const c = safeFreeCol(lane, shooterCols(lane).concat([4, 0]));
        if (c >= 0 && buyBg(kind, c, lane)) return true;
      }
    }
    // P7.5 前线雷区:防线齐了之后,大波压境就在第 7 格预埋爆爆果迎接
    const allArmed = [0, 1, 2, 3].every((l) => laneThreat(l) <= 0 || shootersIn(l).length >= 1);
    if (unlocked.has("boom") && allArmed) {
      for (let lane = 0; lane < LANES; lane++) {
        const lanesNear = [lane - 1, lane, lane + 1].filter((l) => l >= 0 && l < LANES);
        let hpSum = 0;
        let hasBoss = false;
        let sameLaneTrigger = false;
        for (const b of bugs) {
          if (!lanesNear.includes(b.lane) || !revealed(b) || b.x <= 7.2) continue;
          hpSum += b.hp + b.armor;
          hasBoss = hasBoss || BUG_INFO[b.kind].boss;
          sameLaneTrigger = sameLaneTrigger || b.lane === lane;
        }
        for (const l of lanesNear) {
          for (const e of laneArrivals[l]) {
            if (e.time < time || e.time > time + 3.5) continue;
            if (BUG_INFO[e.kind].underground && !scoutAlive[l]) continue;
            hpSum += hpOf(e.kind, e.wave) + BUG_INFO[e.kind].armor;
            hasBoss = hasBoss || BUG_INFO[e.kind].boss;
            sameLaneTrigger = sameLaneTrigger || l === lane;
          }
        }
        if ((hpSum < 20 && !hasBoss) || !sameLaneTrigger) continue;
        const mineNearby = [...plants.values()].some(
          (p) => p.kind === "boom" && lanesNear.includes(p.lane) && p.col >= 6,
        );
        if (mineNearby) continue;
        if (buyBg("boom", 7, lane)) return true;
      }
    }
    // P8 BOSS 加固:双层墙 + 冰 + 第 4 门炮
    for (let lane = 0; lane < LANES; lane++) {
      if (!laneHasBoss[lane]) continue;
      const bossActive =
        bugs.some((b) => b.lane === lane && BUG_INFO[b.kind].boss) ||
        laneArrivals[lane].some(
          (e) => BUG_INFO[e.kind].boss && e.time <= time + 15 && e.time >= time,
        );
      if (!bossActive) continue;
      if (!plants.has(key(5, lane)) && buy(wallKind(), 5, lane)) return true;
      if (unlocked.has("ice") && !hasKindIn(lane, "ice")) {
        const c = safeFreeCol(lane, shooterCols(lane).concat([4, 1]));
        if (c >= 0 && buy("ice", c, lane)) return true;
      }
      if (shootersIn(lane).length < 4) {
        const c = safeFreeCol(lane, shooterCols(lane).concat([4, 1, 0]));
        if (c >= 0 && buy(shooterKind(lane), c, lane)) return true;
      }
    }
    // P9 溅射补位:阳光有富余就在主战道加一株蓬蓬花(一串小虫排队时最赚)
    if (unlocked.has("puff") && sun >= PLANT_SPEC.puff.sun) {
      for (const lane of byThreat) {
        if (laneThreat(lane) < 20 || hasKindIn(lane, "puff")) continue;
        const c = safeFreeCol(lane, shooterCols(lane).concat([4]));
        if (c >= 0 && buyBg("puff", c, lane)) return true;
      }
    }
    // P10 富余倾泻:资源快顶到罐口就继续加炮/加经济/加第二道墙
    const cap = effectiveDewCap(setup.dewCap, producerCount());
    if (puzzle || conveyor || dew >= 10 || (Number.isFinite(cap) && dew >= cap - 1)) {
      for (const lane of byThreat) {
        if (laneThreat(lane) <= 0 || shootersIn(lane).length >= 5) continue;
        const c = safeFreeCol(lane, shooterCols(lane).concat([4, 0]));
        if (c >= 0 && buy(shooterKind(lane), c, lane)) return true;
      }
      if (!puzzle && !conveyor && producerCount() < ecoTarget + 2) {
        for (const lane of [0, 1, 2, 3]) {
          for (const c of [0, 1]) {
            if (!plants.has(key(c, lane)) && cellSafe(c, lane)) {
              if (buy(moonBetter ? "moon" : "sparkle", c, lane)) return true;
              break;
            }
          }
        }
      }
      for (const lane of byThreat) {
        if (laneThreat(lane) < 25) continue;
        if (!plants.has(key(5, lane)) && buy(wallKind(), 5, lane)) return true;
      }
    }
    // P11 传送关兜底:苗是白给的,来一株就赶紧找地方栽下去,别把传送带堵死。
    if (conveyor && queue.length >= 2) {
      const kind = queue[0];
      const cols = isShooterKind(kind)
        ? [2, 3, 1, 4, 0, 5]
        : kind === "nut" || kind === "netpad"
          ? [6, 5, 7, 4]
          : kind === "boom"
            ? [7, 6, 5]
            : [0, 1, 2, 3, 4, 5, 6, 7];
      // 哪条道苗最少就先补哪条,别把火力全堆在一条道上
      const thin = [0, 1, 2, 3]
        .filter((l) => laneThreat(l) > 0)
        .sort((a, b2) => plantsInLane(a) - plantsInLane(b2));
      for (const lane of thin.length > 0 ? thin : byThreat) {
        const c = safeFreeCol(lane, cols);
        if (c >= 0 && buy(kind, c, lane)) return true;
      }
      // 队列快堵死了就顾不上「虫子跟前不种」这一条,先把格子占上
      if (queue.length >= 4) {
        for (const lane of byThreat) {
          for (const c of cols) if (!plants.has(key(c, lane)) && buy(kind, c, lane)) return true;
        }
      }
    }
    return false;
  }

  function decide(): void {
    refreshLaneAids();
    for (let n = 0; n < 3; n++) if (!step()) break;
  }

  function killBug(idx: number): void {
    const b = bugs[idx];
    bugs.splice(idx, 1);
    gainDew(1);
    bugsKilled++;
    log(`打喷嚏跑回家 ${BUG_INFO[b.kind].name} @${b.x.toFixed(1)} L${b.lane}`);
    const splits = BUG_INFO[b.kind].splits ?? 0;
    for (let s = 0; s < splits; s++) {
      const info = BUG_INFO[MAMA_SPLIT_KIND];
      const hp = hpOf(MAMA_SPLIT_KIND, 0);
      bugs.push({
        kind: MAMA_SPLIT_KIND,
        x: b.x + s * 0.25,
        lane: b.lane,
        hp,
        maxHp: hp,
        armor: info.armor,
        speed: info.speed * st.speedMult,
        freeze: 0,
        chewTimer: 0,
        jumped: true,
        dig: 0,
      });
    }
  }

  function damageBug(bi: number, dmg: number, freeze: boolean): void {
    const bug = bugs[bi];
    const res = applyDamage(bug, dmg);
    bug.hp = res.hp;
    bug.armor = res.armor;
    if (freeze) bug.freeze = ICE_SECONDS;
    if (bug.hp <= 0) killBug(bi);
  }

  function boomExplode(p: SimPlant): void {
    plants.delete(key(p.col, p.lane));
    log(`爆爆果轰!(${p.col},${p.lane})`);
    for (let bi = bugs.length - 1; bi >= 0; bi--) {
      const b = bugs[bi];
      if (!revealed(b)) continue;
      if (Math.abs(b.lane - p.lane) <= 1 && Math.abs(b.x - (p.col + 0.5)) <= BOOM_RANGE) {
        damageBug(bi, BOOM_DAMAGE, false);
      }
    }
  }

  const result = (
    win: boolean,
    breachLane = -1,
    breachKind: BugKind | null = null,
    timedOut = false,
  ): SimResult => ({
    win,
    time,
    breachLane,
    breachKind,
    dewEarned,
    dewSpent,
    sunEarned,
    plantsBuilt,
    plantsLost,
    bugsKilled,
    timedOut,
    wavesSurvived,
    trace,
  });

  /* ---------- 主循环(与运行时 update() 同构) ---------- */
  while (time < maxTime) {
    time += DT;
    const night = cyclePhase(time, setup.cycle) === "night";

    while (spawnIdx < schedule.length && schedule[spawnIdx].time <= time) {
      const s = schedule[spawnIdx++];
      const info = BUG_INFO[s.kind];
      const hp = hpOf(s.kind, s.wave);
      bugs.push({
        kind: s.kind,
        x: BUG_SPAWN_X,
        lane: s.lane,
        hp,
        maxHp: hp,
        armor: info.armor,
        speed: info.speed * st.speedMult,
        freeze: 0,
        chewTimer: 0,
        jumped: false,
        dig: info.digs ? TUNNEL_TIME : 0,
      });
    }

    // 卡片冷却
    for (const [k, v] of cardCd) if (v > 0) cardCd.set(k, Math.max(0, v - DT));

    // 传送带:每隔几秒送一株苗进队列(队列满了就等)
    if (conveyor && belt.length > 0) {
      beltTimer -= DT;
      if (beltTimer <= 0) {
        beltTimer = beltEvery;
        if (queue.length < BELT_QUEUE_MAX) {
          queue.push(belt[beltIdx % belt.length]);
          beltIdx++;
        }
      }
    }

    if (!puzzle && !conveyor) {
      passiveTimer -= DT;
      if (passiveTimer <= 0) {
        passiveTimer = passiveDewIntervalAt(setup.scene, night);
        gainDew(1);
      }
    }

    if (build) {
      decideTimer -= DT;
      if (decideTimer <= 0) {
        decideTimer = DECIDE_EVERY;
        decide();
      }
    }

    refreshLaneAids();

    // 植物
    for (const p of plants.values()) {
      if (p.kind === "sparkle") {
        p.prodTimer -= DT;
        if (p.prodTimer <= 0) {
          p.prodTimer = SPARKLE_DEW_EVERY;
          gainDew(1);
        }
      } else if (p.kind === "moon") {
        if (moonActive(!!setup.cycle, night, st.dark)) {
          p.prodTimer -= DT;
          if (p.prodTimer <= 0) {
            p.prodTimer = MOON_DEW_EVERY;
            gainDew(1);
          }
        }
      } else if (p.kind === "sunbud") {
        p.prodTimer -= DT;
        if (p.prodTimer <= 0) {
          p.prodTimer = sunInterval(st.dark || night);
          sun += 1;
          sunEarned += 1;
        }
      } else if (isShooterKind(p.kind)) {
        p.cd -= DT;
        if (p.cd <= 0) {
          const proj = projOf(p.kind);
          const hasTarget = bugs.some(
            (b) =>
              b.lane === p.lane &&
              b.x > p.col + 0.3 &&
              projectileCanHit(proj, BUG_INFO[b.kind].flying) &&
              revealed(b),
          );
          if (hasTarget) {
            p.cd = shootCooldown(proj);
            shots.push({ x: p.col + 0.7, lane: p.lane, proj });
          }
        }
      } else if (p.kind === "boom") {
        const near = bugs.some(
          (b) => b.lane === p.lane && Math.abs(b.x - (p.col + 0.5)) <= BOOM_TRIGGER && revealed(b),
        );
        if (near) boomExplode(p);
      }
    }

    // 子弹
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const spd =
        s.proj === "star" ? STAR_SPEED : s.proj === "ice" ? ICE_SPEED : s.proj === "puff" ? PUFF_SPEED : BUBBLE_SPEED;
      s.x += spd * DT;
      if (s.x > PLANT_COLS + 1.5) {
        shots.splice(i, 1);
        continue;
      }
      for (let bi = 0; bi < bugs.length; bi++) {
        const bug = bugs[bi];
        if (bug.lane !== s.lane || bug.hp <= 0) continue;
        if (!projectileCanHit(s.proj, BUG_INFO[bug.kind].flying)) continue;
        if (!revealed(bug)) continue;
        if (bubbleHitsBug(s.x, bug.x)) {
          const hitX = bug.x;
          shots.splice(i, 1);
          damageBug(bi, 1, s.proj === "ice");
          // 蓬蓬花:花粉团炸开,溅到命中点前后一小片的地面虫
          if (s.proj === "puff") {
            for (let k = bugs.length - 1; k >= 0; k--) {
              const other = bugs[k];
              if (other.lane !== s.lane || BUG_INFO[other.kind].flying) continue;
              if (!revealed(other) || Math.abs(other.x - hitX) > PUFF_SPLASH_RANGE) continue;
              damageBug(k, PUFF_SPLASH_DAMAGE, false);
            }
          }
          break;
        }
      }
    }

    // 虫子
    for (let i = bugs.length - 1; i >= 0; i--) {
      const bug = bugs[i];
      bug.freeze = Math.max(0, bug.freeze - DT);
      if (bug.hp <= 0) {
        killBug(i);
        continue;
      }
      // 挖地:在土里熬完 TUNNEL_TIME,从弹弹网前面(没网就是第 2 列)冒出来
      if (bug.dig > 0) {
        bug.dig -= DT;
        if (bug.dig <= 0) {
          bug.dig = 0;
          bug.x = tunnelExitCol(netpadCols[bug.lane]) + 0.5;
          log(`哧溜虫出土 L${bug.lane} @${bug.x.toFixed(1)}`);
        }
        continue;
      }
      const speedMul =
        (bug.freeze > 0 ? ICE_SLOW : 1) *
        bugNightSpeedMult(bug.kind, night) *
        queenxSpeedMult(bug.kind, bug.hp / bug.maxHp);
      const surfaced = revealed(bug);
      const col = Math.round(bug.x - 0.3 - 0.5);
      const p = BUG_INFO[bug.kind].flying || !surfaced ? undefined : plants.get(key(col, bug.lane));
      if (p && bugReachesPlant(bug.x, p.col)) {
        if (BUG_INFO[bug.kind].jumps && !bug.jumped && canJumpOver(p.kind)) {
          bug.jumped = true;
          bug.x = p.col - 0.55;
          continue;
        }
        bug.chewTimer -= DT;
        if (bug.chewTimer <= 0) {
          bug.chewTimer = BUG_INFO[bug.kind].boss ? BOSS_CHEW_INTERVAL : CHEW_INTERVAL;
          p.hp--;
          if (p.hp <= 0) {
            plants.delete(key(p.col, p.lane));
            plantsLost++;
            log(`${PLANT_INFO[p.kind].name} 被啃倒 (${p.col},${p.lane})`);
            if (p.kind === "scout" || p.kind === "netpad") refreshLaneAids();
          }
        }
      } else {
        bug.chewTimer = 0;
        bug.x -= bug.speed * speedMul * DT;
      }
      if (bug.x <= HOME_X) {
        log(`漏进小屋:${BUG_INFO[bug.kind].name} L${bug.lane}`);
        return result(false, bug.lane, bug.kind);
      }
    }

    // 撑过的波数:这一波的虫全出场了、场上也清空了,就算守住一波
    if (bugs.length === 0 && spawnIdx > 0) {
      const lastSpawnedWave = schedule[spawnIdx - 1].wave;
      const allOut = !schedule.some((s) => s.wave <= lastSpawnedWave && s.time > time);
      if (allOut) wavesSurvived = Math.max(wavesSurvived, lastSpawnedWave + 1);
    }
    if (spawnIdx >= schedule.length && bugs.length === 0) {
      wavesSurvived = setup.totalWaves;
      return result(true);
    }
  }
  if (setup.timeLimit !== undefined) {
    return result(false, -1, null, true);
  }
  return result(false, -1, null);
}

/** 固定策略的三副牌路;不指定流派时依次试,能赢一副就算这一关有解。 */
export const SIM_STYLES: SimStyle[] = ["balanced", "steady", "rush"];

/**
 * 打一关战役(0 起的关号)。
 * 不指定 style 时,依次用「中庸 / 稳扎稳打 / 速攻」三套确定性打法试 ——
 * 只要有一套打得过,这一关就不是死局(结果仍然完全确定,不含随机)。
 */
export function simulateLevel(levelIdx: number, opts: SimOptions = {}): SimResult {
  if (opts.style === undefined && opts.build !== false) {
    let last: SimResult | null = null;
    for (const style of SIM_STYLES) {
      last = simulateLevel(levelIdx, { ...opts, style });
      if (last.win) return last;
    }
    return last as SimResult;
  }
  return simulateOnce(levelIdx, opts);
}

function simulateOnce(levelIdx: number, opts: SimOptions): SimResult {
  const def = LEVELS[levelIdx];
  const schedule = buildLevelSchedule(levelIdx);
  const special = def.special;
  let unlocked: Set<PlantKind>;
  if (special?.kind === "puzzle") {
    unlocked = new Set((special.stock ?? []).map((s) => s.kind));
    if (def.waterLanes.length > 0) unlocked.add("lily");
  } else if (special?.kind === "conveyor") {
    unlocked = new Set(special.belt ?? []);
    if (def.waterLanes.length > 0) unlocked.add("lily");
  } else {
    unlocked = new Set(plantsUnlockedAt(levelIdx, LEVELS));
  }
  return runSim(
    {
      scene: def.scene,
      waterLanes: def.waterLanes,
      startDew: def.startDew,
      cycle: def.cycle,
      dewCap: def.dewCap,
      special,
      schedule,
      unlocked,
      hpLevel: levelIdx,
      timeLimit:
        special?.kind === "blitz"
          ? (schedule[schedule.length - 1]?.time ?? 0) + BLITZ_GRACE
          : undefined,
      totalWaves: def.waves.length,
    },
    opts,
  );
}

export interface EndlessSimResult extends SimResult {
  /** 一路撑到第几波(没被攻破就是跑满 maxWaves) */
  reached: number;
}

/** 无尽「守到天亮」:一路打到被攻破,或者跑满 maxWaves 波。 */
export function simulateEndless(maxWaves = 12, opts: SimOptions = {}): EndlessSimResult {
  const schedule = buildEndlessSchedule(maxWaves);
  const hpBonus = new Map<number, number>();
  for (let n = 1; n <= maxWaves; n++) hpBonus.set(n - 1, endlessWave(n).hpBonus);
  const res = runSim(
    {
      scene: "night",
      waterLanes: [],
      startDew: 8,
      schedule,
      unlocked: new Set(plantsUnlockedAt(LEVELS.length - 1, LEVELS)),
      hpLevel: 40,
      hpBonusOfWave: (wave) => hpBonus.get(wave) ?? 0,
      totalWaves: maxWaves,
      endless: true,
    },
    opts,
  );
  // 成绩 = 完整守住的波数(跑满就是 maxWaves)
  return { ...res, reached: res.win ? maxWaves : res.wavesSurvived };
}
