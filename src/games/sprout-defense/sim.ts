// 绿芽保卫战 1.1 —— 无头模拟器:用一套固定(确定性)策略把一关从头打到尾,
// 验证 188 关的资源曲线可通关、不是死局。只依赖 logic.ts,不碰 DOM。
// 规则与 index.ts 运行时逐条对齐:出虫时间表、露珠经济、射击/啃食节奏、
// 冰冻、爆爆果、钻钻虫跳跃、荷叶、1.1 的昼夜/地下虫/露珠上限/分裂/进化体。

import {
  BOOM_DAMAGE,
  BOOM_RANGE,
  BOOM_TRIGGER,
  BOSS_CHEW_INTERVAL,
  BUBBLE_SPEED,
  BUG_INFO,
  BUG_SPAWN_X,
  BugKind,
  CHEW_INTERVAL,
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
  PlantKind,
  SCENE_STYLE,
  SHOOT_CD,
  SPARKLE_DEW_EVERY,
  STAR_SPEED,
  applyDamage,
  bubbleHitsBug,
  bugHp,
  bugNightSpeedMult,
  bugReachesPlant,
  buildLevelSchedule,
  clampDew,
  cyclePhase,
  effectiveDewCap,
  moleRevealed,
  moonActive,
  passiveDewIntervalAt,
  plantsUnlockedAt,
  projectileCanHit,
  queenxSpeedMult,
} from "./logic";

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
}

interface SimShot {
  x: number;
  lane: number;
  proj: "bubble" | "star" | "ice";
}

export interface SimResult {
  win: boolean;
  time: number;
  breachLane: number;
  breachKind: BugKind | null;
  dewEarned: number;
  dewSpent: number;
  plantsBuilt: number;
  plantsLost: number;
  bugsKilled: number;
  trace: string[];
}

export interface SimOptions {
  /** false = 什么都不种(用来验证 BOSS 关也能打输) */
  build?: boolean;
  trace?: boolean;
}

const DT = 1 / 30;
const DECIDE_EVERY = 0.25;

export function simulateLevel(levelIdx: number, opts: SimOptions = {}): SimResult {
  const build = opts.build !== false;
  const def = LEVELS[levelIdx];
  const st = SCENE_STYLE[def.scene];
  const schedule = buildLevelSchedule(levelIdx);
  const unlocked = new Set(plantsUnlockedAt(levelIdx, LEVELS));
  const maxTime = (schedule[schedule.length - 1]?.time ?? 0) + 300;

  const plants = new Map<string, SimPlant>();
  const lilies = new Set<string>();
  const bugs: SimBug[] = [];
  const shots: SimShot[] = [];
  let dew = def.startDew;
  let time = 0;
  let spawnIdx = 0;
  let passiveTimer = passiveDewIntervalAt(def.scene, false);
  let decideTimer = 0.5;
  let dewEarned = 0;
  let dewSpent = 0;
  let plantsBuilt = 0;
  let plantsLost = 0;
  let bugsKilled = 0;
  const trace: string[] = [];
  const log = (s: string) => {
    if (opts.trace) trace.push(`t=${time.toFixed(1)} ${s}`);
  };

  /* ---------- 关卡情报(固定策略允许读关卡定义,策略本身是确定性的) ---------- */
  const laneArrivals: Array<Array<{ time: number; kind: BugKind }>> = Array.from(
    { length: LANES },
    () => [],
  );
  for (const s of schedule) laneArrivals[s.lane].push({ time: s.time, kind: s.kind });
  const laneHasFlyer = laneArrivals.map((a) => a.some((e) => BUG_INFO[e.kind].flying));
  const laneHasMole = laneArrivals.map((a) => a.some((e) => BUG_INFO[e.kind].underground));
  const laneHasFast = laneArrivals.map((a) =>
    a.some((e) => BUG_INFO[e.kind].speed * st.speedMult >= 0.85 || BUG_INFO[e.kind].nightMult),
  );
  const laneHasBoss = laneArrivals.map((a) => a.some((e) => BUG_INFO[e.kind].boss));

  const key = (col: number, lane: number) => `${col},${lane}`;
  const producerCount = () =>
    [...plants.values()].filter((p) => p.kind === "sparkle" || p.kind === "moon").length;
  const gainDew = (n: number) => {
    dew = clampDew(dew + n, effectiveDewCap(def.dewCap, producerCount()));
    dewEarned += n;
  };

  const scoutAlive: boolean[] = new Array(LANES).fill(false);
  const refreshScouts = () => {
    scoutAlive.fill(false);
    for (const p of plants.values()) if (p.kind === "scout") scoutAlive[p.lane] = true;
  };
  const revealed = (b: SimBug) => moleRevealed(b.kind, scoutAlive[b.lane]);

  function buy(kind: PlantKind, col: number, lane: number): boolean {
    if (col < 0 || col > 7) return false;
    const k = key(col, lane);
    const water = def.waterLanes.includes(lane);
    if (water && !lilies.has(k)) {
      if (!unlocked.has("lily") || dew < PLANT_INFO.lily.cost) return false;
      dew -= PLANT_INFO.lily.cost;
      dewSpent += PLANT_INFO.lily.cost;
      lilies.add(k);
      log(`铺荷叶 (${col},${lane})`);
      return true;
    }
    if (plants.has(k)) return false;
    if (!unlocked.has(kind) || dew < PLANT_INFO[kind].cost) return false;
    dew -= PLANT_INFO[kind].cost;
    dewSpent += PLANT_INFO[kind].cost;
    plants.set(k, {
      kind,
      col,
      lane,
      hp: PLANT_INFO[kind].hp,
      cd: 0.5,
      prodTimer: kind === "moon" ? MOON_DEW_EVERY : SPARKLE_DEW_EVERY,
    });
    plantsBuilt++;
    log(`种 ${PLANT_INFO[kind].name} (${col},${lane}) 剩💧${dew}`);
    if (kind === "scout") refreshScouts();
    return true;
  }

  const isShooter = (k: PlantKind) => k === "bubble" || k === "star" || k === "ice";
  const shootersIn = (lane: number) =>
    [...plants.values()].filter((p) => p.lane === lane && isShooter(p.kind));
  const hasKindIn = (lane: number, kind: PlantKind) =>
    [...plants.values()].some((p) => p.lane === lane && p.kind === kind);
  /** 车道剩余威胁:场上活虫 + 还没出场的虫的(血+甲)总和。 */
  function laneThreat(lane: number): number {
    let s = 0;
    for (const b of bugs) if (b.lane === lane) s += b.hp + b.armor;
    for (let i = spawnIdx; i < schedule.length; i++) {
      if (schedule[i].lane === lane) {
        s += bugHp(schedule[i].kind, levelIdx) + BUG_INFO[schedule[i].kind].armor;
      }
    }
    return s;
  }
  function nextArrival(lane: number): number {
    for (let i = spawnIdx; i < schedule.length; i++) {
      if (schedule[i].lane === lane) return schedule[i].time;
    }
    return Infinity;
  }
  function moleSoon(lane: number): boolean {
    for (const b of bugs) if (b.lane === lane && BUG_INFO[b.kind].underground) return true;
    for (let i = spawnIdx; i < schedule.length; i++) {
      const s = schedule[i];
      if (s.lane === lane && BUG_INFO[s.kind].underground && s.time <= time + 12) return true;
    }
    return false;
  }
  /** 虫子前方(含正在啃的)剩余"啃食拖延时间"(秒):不够就要补应急墩。 */
  function stallAhead(bug: SimBug): number {
    const per = BUG_INFO[bug.kind].boss ? BOSS_CHEW_INTERVAL : CHEW_INTERVAL;
    let s = 0;
    for (const p of plants.values()) {
      if (p.lane === bug.lane && bug.x >= p.col - 0.1) s += p.hp * per;
    }
    return s;
  }
  /** 只算果果墩的拖延时间:炮和闪光芽不该拿去喂虫,墙要及时立。 */
  function nutStallAhead(bug: SimBug): number {
    const per = BUG_INFO[bug.kind].boss ? BOSS_CHEW_INTERVAL : CHEW_INTERVAL;
    let s = 0;
    for (const p of plants.values()) {
      if (p.kind === "nut" && p.lane === bug.lane && bug.x >= p.col - 0.1) s += p.hp * per;
    }
    return s;
  }

  const shooterCols = (lane: number) => (laneHasMole[lane] ? [2, 3, 4] : [1, 2, 3]);
  const wallCol = 6;
  const moonBetter = unlocked.has("moon") && !def.cycle && st.dark;
  const ecoTarget = 5 + (st.dewMult >= 1.3 ? 1 : 0);

  /** 这条道上狂飙的风风虫是不是已经在场/马上就到(才值得提前掏钱伺候)。 */
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
    if (flyerSoon && unlocked.has("star")) return "star";
    if (rusherSoon(lane, 12) && unlocked.has("ice") && !hasKindIn(lane, "ice")) return "ice";
    return "bubble";
  }

  /** 这一格眼下安全吗:车道上没有已现形的地面虫马上啃到这里。 */
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
  /** 车道紧迫度:统一换算成"最早何时有虫进小屋"。 */
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
  // 没有安全格就宁可不种 —— 种进虫嘴里等于白送露珠
  const safeFreeCol = (lane: number, prefer: number[]): number => {
    for (const c of prefer) if (!plants.has(key(c, lane)) && cellSafe(c, lane)) return c;
    return -1;
  };
  const shooterKind = (lane: number): PlantKind =>
    laneHasFlyer[lane] && unlocked.has("star") ? "star" : "bubble";

  /**
   * 固定策略的一步:按优先级找到第一件该办的事,办成返回 true。
   * 思路:果果墩(2 珠拖 12 秒)+ 爆爆果(4 珠轰一坨)是主力,
   * 闪光芽(1 珠 4.5 秒回本)猛攒经济,炮数跟着车道剩余威胁走。
   * 高优先级(望望草/每道第一门炮)缺钱时会"攒钱等",不让低优先级抢预算。
   */
  function step(): boolean {
    // P1 应急:地面虫快漏进小屋且前方拖不住(最危险的先救)。
    // 没炮的车道先在虫身后架炮(炮能打前方的虫),再贴脸补果果墩拖时间。
    const endangered = bugs
      .filter(
        (b) =>
          !BUG_INFO[b.kind].flying && revealed(b) && b.x < 4.5 && b.x > 0.8 && stallAhead(b) < 2.6,
      )
      .sort((a, b2) => a.x - b2.x);
    for (const b of endangered) {
      // 先立墙拖住:墙位尽量靠前,但要留在"虫还没啃到、身后的炮还打得着"的格子
      const cNut = Math.min(5, Math.floor(b.x - 0.7));
      for (let c = cNut; c >= 0; c--) {
        if (!plants.has(key(c, b.lane))) {
          if (dew < PLANT_INFO.nut.cost) return false; // 攒钱救急,别去干别的
          if (buy("nut", c, b.lane)) return true;
          break;
        }
      }
      // 虫身后一门炮都没有(前面的炮打不到身后的虫),贴着补一门泡泡
      const gunsBehind = shootersIn(b.lane).filter((p) => p.col + 0.3 < b.x).length;
      if (gunsBehind === 0) {
        for (let c = Math.max(0, Math.floor(b.x - 0.5)); c >= 0; c--) {
          if (!plants.has(key(c, b.lane)) && buy("bubble", c, b.lane)) return true;
        }
      }
    }
    // P2 望望草:地下虫将至的车道,一道一棵,倒了就补;缺钱就攒。
    // 望望草照亮整条道,种哪格都行 —— 哪里空种哪里。
    if (unlocked.has("scout")) {
      for (let lane = 0; lane < LANES; lane++) {
        if (!moleSoon(lane) || scoutAlive[lane]) continue;
        const c = safeFreeCol(lane, [0, 1, 2, 3, 4, 5, 6, 7]);
        if (c < 0) continue;
        if (dew < PLANT_INFO.scout.cost) return false; // 攒钱等望望草
        if (buy("scout", c, lane)) return true;
      }
    }
    // P3 每道第一门炮(按紧迫度排序);缺钱就攒,不让低优先级抢预算
    const laneOrder = [0, 1, 2, 3].sort((a, b2) => laneUrgency(a) - laneUrgency(b2));
    if (opts.trace) {
      trace.push(
        `t=${time.toFixed(1)} DBG u=[${[0, 1, 2, 3].map((l) => laneUrgency(l).toFixed(0)).join(",")}] dew=${dew} bugs=[${bugs.map((b) => `${b.kind}@${b.x.toFixed(1)}L${b.lane}`).join(" ")}]`,
      );
    }
    for (const lane of laneOrder) {
      if (laneThreat(lane) <= 0 || shootersIn(lane).length >= 1) continue;
      if (laneUrgency(lane) > time + 25) continue;
      const kind = firstShooterKind(lane);
      const c = safeFreeCol(lane, shooterCols(lane));
      if (c < 0) continue;
      if (dew < PLANT_INFO[kind].cost) return false; // 攒钱等第一门炮
      if (buy(kind, c, lane)) return true;
    }
    // P3.5 防空:飞虫拦不了墙,快到的车道必须有一门打得着天上的炮(星星/冰冰)
    if (unlocked.has("star")) {
      for (const lane of laneOrder) {
        const flyerSoon =
          bugs.some((b) => b.lane === lane && BUG_INFO[b.kind].flying) ||
          laneArrivals[lane].some(
            (e) => BUG_INFO[e.kind].flying && e.time >= time && e.time <= time + 15,
          );
        if (!flyerSoon) continue;
        const antiAir = shootersIn(lane).some((p) => p.kind === "star" || p.kind === "ice");
        if (antiAir) continue;
        const c = safeFreeCol(lane, shooterCols(lane).concat([4, 0]));
        if (c < 0) continue;
        if (dew < PLANT_INFO.star.cost) return false; // 攒钱等防空炮
        if (buy("star", c, lane)) return true;
      }
    }
    // P4 城墙:有炮的车道,地面威胁扛不住(前方拖不满 5 秒)就在虫前立墙;
    // 狂飙车道(风风虫)在虫到场前预立。缺钱时攒钱等墙,不让低优先级抢预算。
    for (const lane of laneOrder) {
      if (shootersIn(lane).length === 0) continue;
      const ground = bugs.filter(
        (b) => b.lane === lane && !BUG_INFO[b.kind].flying && revealed(b) && b.x > 1.4,
      );
      if (ground.length === 0) {
        if (rusherSoon(lane, 10) && !plants.has(key(wallCol, lane))) {
          if (buy("nut", wallCol, lane)) return true;
        }
        continue;
      }
      const front = ground.sort((a, b2) => a.x - b2.x)[0];
      const hpSum = ground.reduce((s, b) => s + b.hp + b.armor, 0);
      // 炮火在虫走到炮位前打不完这条道的血量,就需要一面墙来拖
      const dps = shootersIn(lane).length / SHOOT_CD;
      const tReach = (front.x - 1.6) / Math.max(0.1, front.speed) + nutStallAhead(front);
      if (hpSum > dps * tReach && front.x < 7.9 && nutStallAhead(front) < 5) {
        const c = Math.min(wallCol, Math.floor(front.x - 0.8));
        if (c >= 1 && !plants.has(key(c, lane))) {
          if (dew < PLANT_INFO.nut.cost) return false; // 攒钱等墙
          if (buy("nut", c, lane)) return true;
        }
      }
    }
    // P5 爆爆果:墙前一坨厚虫(或 BOSS 压阵)→ 贴虫前埋一颗,炸完可续
    if (unlocked.has("boom")) {
      for (let lane = 0; lane < LANES; lane++) {
        const inLane = bugs.filter((b) => b.lane === lane && b.x < 7.6 && b.x > 1.3 && revealed(b));
        if (inLane.length === 0) continue;
        const front = Math.min(...inLane.map((b) => b.x));
        const c = Math.max(0, Math.min(7, Math.floor(front - 0.75)));
        // 触发时波及爆点 ±1.6 格、上下三条道 —— 把稍后赶到的虫也算进来
        const cluster = bugs.filter(
          (b) => Math.abs(b.lane - lane) <= 1 && revealed(b) && b.x > c - 1.1 && b.x < c + 3.4,
        );
        const hpSum = cluster.reduce((s, b) => s + b.hp + b.armor, 0);
        const hasBoss = cluster.some((b) => BUG_INFO[b.kind].boss);
        if (hpSum < 14 && !hasBoss) continue;
        // 只看本道的雷:邻道的爆爆果只会被邻道的虫踩响,帮不了这条道
        const boomNearby = [...plants.values()].some(
          (p) => p.kind === "boom" && p.lane === lane && Math.abs(p.col - c) <= 1,
        );
        if (boomNearby) continue;
        // 首选格被占就往前(靠家方向)挪一两格 —— 虫走过来照样踩响
        for (let cc = c; cc >= Math.max(0, c - 2); cc--) {
          if (!plants.has(key(cc, lane)) && buy("boom", cc, lane)) return true;
        }
      }
    }
    // 打仗时手里留 2 珠应急(补墙/补炮),非紧急购买不许花光
    const reserve = bugs.some((b) => b.x < 6.5) ? 2 : 0;
    const buyBg = (kind: PlantKind, col: number, lane: number): boolean =>
      dew >= PLANT_INFO[kind].cost + reserve && buy(kind, col, lane);
    // P6 经济:闪光芽 1 珠 4.5 秒回本,猛攒到目标棵数(优先最晚才来虫的车道,只种安全格)
    if (producerCount() < ecoTarget) {
      const ecoLanes = [0, 1, 2, 3]
        .filter((l) => !def.waterLanes.includes(l))
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
    // P7 火力升级:炮数跟着车道剩余威胁走(飞虫道用星星,快虫道配冰)。
    // 先把每条道补到两门,再谈第三门 —— 雨露均沾,别把一条道堆成炮塔山
    const byThreat = [0, 1, 2, 3].sort((a, b2) => laneThreat(b2) - laneThreat(a));
    for (let d = 2; d <= 4; d++) {
      for (const lane of byThreat) {
        const threat = laneThreat(lane);
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
            hpSum += bugHp(e.kind, levelIdx) + BUG_INFO[e.kind].armor;
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
      if (!plants.has(key(5, lane)) && buy("nut", 5, lane)) return true;
      if (unlocked.has("ice") && !hasKindIn(lane, "ice")) {
        const c = safeFreeCol(lane, shooterCols(lane).concat([4, 1]));
        if (c >= 0 && buy("ice", c, lane)) return true;
      }
      if (shootersIn(lane).length < 4) {
        const c = safeFreeCol(lane, shooterCols(lane).concat([4, 1, 0]));
        if (c >= 0 && buy(shooterKind(lane), c, lane)) return true;
      }
    }
    // P10 富余倾泻:露珠快顶到罐口就继续加炮/加经济/加第二道墙
    const cap = effectiveDewCap(def.dewCap, producerCount());
    if (dew >= 10 || (Number.isFinite(cap) && dew >= cap - 1)) {
      for (const lane of byThreat) {
        if (laneThreat(lane) <= 0 || shootersIn(lane).length >= 5) continue;
        const c = safeFreeCol(lane, shooterCols(lane).concat([4, 0]));
        if (c >= 0 && buy(shooterKind(lane), c, lane)) return true;
      }
      if (producerCount() < ecoTarget + 2) {
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
        if (!plants.has(key(5, lane)) && buy("nut", 5, lane)) return true;
      }
    }
    return false;
  }

  function decide(): void {
    refreshScouts();
    for (let n = 0; n < 3; n++) if (!step()) break;
  }

  function killBug(idx: number): void {
    const b = bugs[idx];
    bugs.splice(idx, 1);
    gainDew(1);
    bugsKilled++;
    log(`击倒 ${BUG_INFO[b.kind].name} @${b.x.toFixed(1)} L${b.lane}`);
    const splits = BUG_INFO[b.kind].splits ?? 0;
    for (let s = 0; s < splits; s++) {
      const info = BUG_INFO[MAMA_SPLIT_KIND];
      bugs.push({
        kind: MAMA_SPLIT_KIND,
        x: b.x + s * 0.25,
        lane: b.lane,
        hp: bugHp(MAMA_SPLIT_KIND, levelIdx),
        maxHp: bugHp(MAMA_SPLIT_KIND, levelIdx),
        armor: info.armor,
        speed: info.speed * st.speedMult,
        freeze: 0,
        chewTimer: 0,
        jumped: true,
      });
    }
  }

  function boomExplode(p: SimPlant): void {
    plants.delete(key(p.col, p.lane));
    log(`爆爆果轰!(${p.col},${p.lane})`);
    for (let bi = bugs.length - 1; bi >= 0; bi--) {
      const b = bugs[bi];
      if (!revealed(b)) continue;
      if (Math.abs(b.lane - p.lane) <= 1 && Math.abs(b.x - (p.col + 0.5)) <= BOOM_RANGE) {
        const res = applyDamage(b, BOOM_DAMAGE);
        b.hp = res.hp;
        b.armor = res.armor;
        if (b.hp <= 0) killBug(bi);
      }
    }
  }

  const result = (win: boolean, breachLane = -1, breachKind: BugKind | null = null): SimResult => ({
    win,
    time,
    breachLane,
    breachKind,
    dewEarned,
    dewSpent,
    plantsBuilt,
    plantsLost,
    bugsKilled,
    trace,
  });

  /* ---------- 主循环(与运行时 update() 同构) ---------- */
  while (time < maxTime) {
    time += DT;
    const night = cyclePhase(time, def.cycle) === "night";

    while (spawnIdx < schedule.length && schedule[spawnIdx].time <= time) {
      const s = schedule[spawnIdx++];
      const info = BUG_INFO[s.kind];
      bugs.push({
        kind: s.kind,
        x: BUG_SPAWN_X,
        lane: s.lane,
        hp: bugHp(s.kind, levelIdx),
        maxHp: bugHp(s.kind, levelIdx),
        armor: info.armor,
        speed: info.speed * st.speedMult,
        freeze: 0,
        chewTimer: 0,
        jumped: false,
      });
    }

    passiveTimer -= DT;
    if (passiveTimer <= 0) {
      passiveTimer = passiveDewIntervalAt(def.scene, night);
      gainDew(1);
    }

    if (build) {
      decideTimer -= DT;
      if (decideTimer <= 0) {
        decideTimer = DECIDE_EVERY;
        decide();
      }
    }

    refreshScouts();

    // 植物
    for (const p of plants.values()) {
      if (p.kind === "sparkle") {
        p.prodTimer -= DT;
        if (p.prodTimer <= 0) {
          p.prodTimer = SPARKLE_DEW_EVERY;
          gainDew(1);
        }
      } else if (p.kind === "moon") {
        if (moonActive(!!def.cycle, night, st.dark)) {
          p.prodTimer -= DT;
          if (p.prodTimer <= 0) {
            p.prodTimer = MOON_DEW_EVERY;
            gainDew(1);
          }
        }
      } else if (isShooter(p.kind)) {
        p.cd -= DT;
        if (p.cd <= 0) {
          const proj = p.kind as "bubble" | "star" | "ice";
          const hasTarget = bugs.some(
            (b) =>
              b.lane === p.lane &&
              b.x > p.col + 0.3 &&
              projectileCanHit(proj, BUG_INFO[b.kind].flying) &&
              revealed(b),
          );
          if (hasTarget) {
            p.cd = SHOOT_CD;
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
      const spd = s.proj === "star" ? STAR_SPEED : s.proj === "ice" ? ICE_SPEED : BUBBLE_SPEED;
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
          const res = applyDamage(bug, 1);
          bug.hp = res.hp;
          bug.armor = res.armor;
          if (s.proj === "ice") bug.freeze = ICE_SECONDS;
          shots.splice(i, 1);
          if (bug.hp <= 0) killBug(bi);
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
      const speedMul =
        (bug.freeze > 0 ? ICE_SLOW : 1) *
        bugNightSpeedMult(bug.kind, night) *
        queenxSpeedMult(bug.kind, bug.hp / bug.maxHp);
      const surfaced = revealed(bug);
      const col = Math.round(bug.x - 0.3 - 0.5);
      const p = BUG_INFO[bug.kind].flying || !surfaced ? undefined : plants.get(key(col, bug.lane));
      if (p && bugReachesPlant(bug.x, p.col)) {
        if (BUG_INFO[bug.kind].jumps && !bug.jumped) {
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
            if (p.kind === "scout") refreshScouts();
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

    if (spawnIdx >= schedule.length && bugs.length === 0) {
      return result(true);
    }
  }
  return result(false, -1, null);
}
