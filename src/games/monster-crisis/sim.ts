// 小怪物危机 —— 无头模拟器。
//
// 用一套写死的、完全确定性的「合理操作」把一关从头打到尾,验证 188 关都守得住,
// 顺便验证「什么都不做」一定守不住(说明关卡不是白送的)。只依赖 logic.ts /
// levels.ts,不碰 DOM,规则与 index.ts 里的实时玩法逐条对齐。

import {
  BUILD_COLS,
  CHEW_REACH,
  FROST_SECONDS,
  HERO_BULLET_SPEED,
  HOME_X,
  INTERMISSION_PAINT_BOOST,
  INTERMISSION_SECONDS,
  LANES,
  MONSTER_INFO,
  type MonsterKind,
  type ProjectileKind,
  SPAWN_X,
  type TechLine,
  type TechState,
  TECH_MAX,
  TOWER_INFO,
  type TowerKind,
  applyHit,
  blastDamage,
  campaignStars,
  canHit,
  chewDamage,
  chewInterval,
  clampPaint,
  colX,
  emptyTech,
  heroDamage,
  heroReload,
  heroSpeed,
  jarInterval,
  monsterArmor,
  monsterHp,
  monsterSpeed,
  paintCap,
  paintInterval,
  techCost,
  towerDamage,
  towersUnlockedAt,
  willJump,
} from "./logic";
import { LEVELS, type LevelDef, buildCoopWave, buildEndlessWave, endlessLevelIndex } from "./levels";

const DT = 1 / 30;
const DECIDE_EVERY = 0.25;
const TOWER_SHOT_SPEED = 7;

interface SimMonster {
  kind: MonsterKind;
  x: number;
  lane: number;
  hp: number;
  armor: number;
  base: number;
  frost: number;
  chewCd: number;
  jumped: boolean;
  flying: boolean;
  boss: boolean;
}

interface SimTower {
  kind: TowerKind;
  col: number;
  lane: number;
  hp: number;
  cd: number;
  prod: number;
}

interface SimShot {
  x: number;
  lane: number;
  dmg: number;
  proj: ProjectileKind;
  slows: boolean;
  speed: number;
}

export interface SimResult {
  win: boolean;
  hearts: number;
  homeHp: number;
  /** 打到第几波(1 基) */
  waveReached: number;
  waveTotal: number;
  time: number;
  popped: number;
  /** 每条道被溜进去几只 */
  leaks: number[];
  paintEarned: number;
  paintSpent: number;
  towersBuilt: number;
  tech: TechState;
  stars: 1 | 2 | 3;
  trace: string[];
}

export interface SimOptions {
  /** false = 一个建筑都不摆(用来验证关卡不是白送的) */
  build?: boolean;
  /** false = 主角不开枪 */
  shoot?: boolean;
  /** false = 不升科技 */
  tech?: boolean;
  trace?: boolean;
  /** 超时保护(秒) */
  maxSeconds?: number;
  /** 每一波用哪个「等效关号」算血量(无尽 / 合作越往后越厚) */
  levelIdxFor?: (waveIdx: number) => number;
}

/** 按等效关号取一只小怪物的属性(战役直接用关号,无尽/合作用换算出来的等效关号)。 */
function spawnMonster(kind: MonsterKind, lane: number, levelIdx: number): SimMonster {
  const spec = MONSTER_INFO[kind];
  return {
    kind,
    x: SPAWN_X,
    lane,
    hp: monsterHp(kind, levelIdx),
    armor: monsterArmor(kind, levelIdx),
    base: spec.speed,
    frost: 0,
    chewCd: chewInterval(!!spec.boss),
    jumped: false,
    flying: !!spec.flying,
    boss: !!spec.boss,
  };
}

/** 模拟一关(或一段无尽 / 合作波次)。 */
export function simulateRun(def: LevelDef, levelIdx: number, opts: SimOptions = {}): SimResult {
  const doBuild = opts.build !== false;
  const doShoot = opts.shoot !== false;
  const doTech = opts.tech !== false && doBuild;
  const maxSeconds = opts.maxSeconds ?? 900;
  const idxFor = opts.levelIdxFor ?? (() => levelIdx);
  const trace: string[] = [];

  const unlocked = new Set<TowerKind>(towersUnlockedAt(def.chapter));
  const blocked = new Set<string>(def.blocked.map((c) => `${c.col},${c.lane}`));
  const towers = new Map<string, SimTower>();
  const monsters: SimMonster[] = [];
  const shots: SimShot[] = [];
  const tech: TechState = emptyTech();
  const leaks = new Array<number>(LANES).fill(0);

  let paint = def.startPaint;
  let paintEarned = def.startPaint;
  let paintSpent = 0;
  let towersBuilt = 0;
  let popped = 0;
  let hearts = def.homeHp;
  let time = 0;
  let passive = paintInterval(0);
  let decide = 0.3;

  // 主角:横坐标固定守在家门口,靠上下换道支援最危险的那条
  let heroLane = (LANES - 1) / 2;
  const heroX = 0.8;
  let heroCd = 0;

  let waveIdx = 0;
  let phase: "prep" | "wave" = "prep";
  let phaseTime = INTERMISSION_SECONDS;
  let waveTime = 0;
  let spawnIdx = 0;
  let win = false;
  let over = false;

  const log = (s: string): void => {
    if (opts.trace) trace.push(`t=${time.toFixed(1)} ${s}`);
  };
  const key = (col: number, lane: number): string => `${col},${lane}`;
  const gain = (n: number): void => {
    const before = paint;
    paint = clampPaint(paint + n, paintCap(tech.paint));
    paintEarned += paint - before;
  };

  function build(kind: TowerKind, col: number, lane: number): boolean {
    if (!doBuild || !unlocked.has(kind)) return false;
    if (col < 0 || col >= BUILD_COLS || lane < 0 || lane >= LANES) return false;
    const k = key(col, lane);
    if (towers.has(k) || blocked.has(k)) return false;
    const cost = TOWER_INFO[kind].cost;
    if (paint < cost) return false;
    paint -= cost;
    paintSpent += cost;
    towers.set(k, {
      kind,
      col,
      lane,
      hp: TOWER_INFO[kind].hp,
      cd: 0.4,
      prod: jarInterval(tech.paint),
    });
    towersBuilt++;
    log(`摆 ${TOWER_INFO[kind].name} (${col},${lane}) 剩🎨${paint}`);
    return true;
  }

  function buyTech(line: TechLine): boolean {
    if (!doTech || tech[line] >= TECH_MAX) return false;
    const cost = techCost(line, tech[line]);
    if (paint < cost) return false;
    paint -= cost;
    paintSpent += cost;
    tech[line]++;
    log(`升 ${line} → ${tech[line]} 剩🎨${paint}`);
    return true;
  }

  /* ---------------- 关卡情报:固定策略允许读出怪表,但策略本身没有随机 ---------------- */

  const laneKinds: MonsterKind[][] = Array.from({ length: LANES }, () => []);
  for (const w of def.waves) for (const s of w.spawns) laneKinds[s.lane].push(s.kind);
  const laneHasAir = laneKinds.map((ks) => ks.some((k) => MONSTER_INFO[k].flying));
  const laneHasGround = laneKinds.map((ks) => ks.some((k) => !MONSTER_INFO[k].flying));
  const laneHasJumper = laneKinds.map((ks) => ks.some((k) => MONSTER_INFO[k].jumps));
  const laneHeat = laneKinds.map((ks) =>
    ks.reduce((s, k) => s + monsterHp(k, levelIdx) + monsterArmor(k, levelIdx), 0)
  );

  const towersIn = (lane: number): SimTower[] => [...towers.values()].filter((t) => t.lane === lane);
  const shootersIn = (lane: number): number =>
    towersIn(lane).filter((t) => (TOWER_INFO[t.kind].dmg ?? 0) > 0).length;
  const jarCount = (): number => [...towers.values()].filter((t) => t.kind === "jar").length;
  const hasKindIn = (lane: number, kind: TowerKind): boolean =>
    towersIn(lane).some((t) => t.kind === kind);

  /** 这个格子眼下安全吗:没有地面小怪物马上啃到这儿。 */
  function cellSafe(col: number, lane: number): boolean {
    const cx = colX(col);
    return !monsters.some((m) => m.lane === lane && !m.flying && m.x > cx - 0.4 && m.x < cx + 2.4);
  }

  function freeCol(lane: number, prefer: readonly number[]): number {
    for (const c of prefer) {
      if (!towers.has(key(c, lane)) && !blocked.has(key(c, lane)) && cellSafe(c, lane)) return c;
    }
    return -1;
  }

  /** 小怪物前方还有多少「够啃的时间」,不够就得赶紧补墙。 */
  function stallAhead(m: SimMonster): number {
    if (m.flying) return 0;
    const per = chewInterval(m.boss);
    const dmg = chewDamage(m.boss);
    let s = 0;
    for (const t of towers.values()) {
      if (t.lane === m.lane && colX(t.col) <= m.x + CHEW_REACH) s += (t.hp / dmg) * per;
    }
    return s;
  }

  const ecoTarget = def.chapter >= 6 ? 5 : def.chapter >= 3 ? 4 : 3;
  const shooterCap = def.chapter >= 5 ? 4 : def.chapter >= 2 ? 3 : 2;
  const bossLane = (() => {
    for (const w of def.waves) for (const s of w.spawns) if (MONSTER_INFO[s.kind].boss) return s.lane;
    return -1;
  })();

  /** 这条道该架什么炮:有飞的且彩虹灯塔解锁了就上灯塔,否则泡泡炮。 */
  function shooterKind(lane: number): TowerKind {
    if (laneHasAir[lane] && unlocked.has("beam")) return "beam";
    return "pop";
  }

  /**
   * 固定策略的一步:按优先级找第一件该办的事,办成就返回 true。
   * 高优先级缺钱时直接返回 false(攒钱等着),不让低优先级把预算花光。
   */
  function strategyStep(): boolean {
    if (!doBuild) return false;

    // P1 救急:有地面小怪物快溜到家门口,而且前面拖不住了,立刻补一堵棉花墙
    const danger = monsters
      .filter((m) => !m.flying && m.x < 5 && m.x > 0.9 && stallAhead(m) < 2.4)
      .sort((a, b) => a.x - b.x);
    for (const m of danger) {
      const col = Math.min(BUILD_COLS - 1, Math.floor(m.x - 0.8));
      for (let c = col; c >= 0; c--) {
        if (towers.has(key(c, m.lane)) || blocked.has(key(c, m.lane))) continue;
        if (paint < TOWER_INFO.wall.cost) return false;
        if (build("wall", c, m.lane)) return true;
        break;
      }
    }

    // P2 经济:颜料罐先摆够,后面才买得起炮台和科技
    if (jarCount() < ecoTarget) {
      for (let lane = 0; lane < LANES; lane++) {
        const c = freeCol(lane, [0, 1]);
        if (c < 0) continue;
        if (paint < TOWER_INFO.jar.cost) return false;
        if (build("jar", c, lane)) return true;
      }
    }

    // P3 每条会来怪的道先架一门炮
    for (let lane = 0; lane < LANES; lane++) {
      if (!laneKinds[lane].length || shootersIn(lane) > 0) continue;
      const kind = shooterKind(lane);
      const c = freeCol(lane, [2, 3, 4]);
      if (c < 0) continue;
      if (paint < TOWER_INFO[kind].cost) return false;
      if (build(kind, c, lane)) return true;
    }

    // P4 每条会来地面怪的道立一堵墙(跳跳怪的道立两堵)
    for (let lane = 0; lane < LANES; lane++) {
      if (!laneHasGround[lane]) continue;
      const walls = towersIn(lane).filter((t) => t.kind === "wall").length;
      const want = laneHasJumper[lane] ? 2 : 1;
      if (walls >= want) continue;
      const c = freeCol(lane, [6, 7, 5]);
      if (c < 0) continue;
      if (paint < TOWER_INFO.wall.cost) return false;
      if (build("wall", c, lane)) return true;
    }

    // P5 科技:颜料线优先(利滚利),再炮台线,最后主角线;手里始终留点救急钱
    if (doTech) {
      const reserve = TOWER_INFO.wall.cost + 1;
      const order: TechLine[] = ["paint", "tower", "hero"];
      for (const line of order) {
        if (tech[line] >= TECH_MAX) continue;
        const cost = techCost(line, tech[line]);
        if (tech[line] >= 2 && line === "paint" && jarCount() < ecoTarget) break;
        if (paint >= cost + reserve && buyTech(line)) return true;
        break;
      }
    }

    // P6 大怪那条道:先埋一桶爆米花,再加炮
    if (bossLane >= 0 && unlocked.has("boom") && !hasKindIn(bossLane, "boom")) {
      const c = freeCol(bossLane, [5, 4, 6]);
      if (c >= 0 && paint >= TOWER_INFO.boom.cost && build("boom", c, bossLane)) return true;
    }

    // P7 补炮:哪条道剩下的血量最多就先补哪条
    const order = [...Array(LANES).keys()]
      .filter((lane) => laneKinds[lane].length > 0 && shootersIn(lane) < shooterCap)
      .sort((a, b) => laneHeat[b] - laneHeat[a]);
    for (const lane of order) {
      const kind = shootersIn(lane) >= 2 && unlocked.has("frost") && !hasKindIn(lane, "frost")
        ? "frost"
        : shooterKind(lane);
      const c = freeCol(lane, [2, 3, 4, 5]);
      if (c < 0) continue;
      if (paint >= TOWER_INFO[kind].cost && build(kind, c, lane)) return true;
    }

    return false;
  }

  /* ---------------- 主循环 ---------------- */

  while (!over && time < maxSeconds) {
    time += DT;

    // 出怪
    if (phase === "wave") {
      waveTime += DT;
      const wave = def.waves[waveIdx];
      while (spawnIdx < wave.spawns.length && wave.spawns[spawnIdx].time <= waveTime) {
        const s = wave.spawns[spawnIdx++];
        monsters.push(spawnMonster(s.kind, s.lane, idxFor(waveIdx)));
      }
      if (spawnIdx >= wave.spawns.length && monsters.length === 0) {
        if (waveIdx >= def.waves.length - 1) {
          win = true;
          over = true;
          break;
        }
        waveIdx++;
        spawnIdx = 0;
        waveTime = 0;
        phase = "prep";
        phaseTime = INTERMISSION_SECONDS;
        log(`第 ${waveIdx} 波清空,进入备战`);
      }
    } else {
      phaseTime -= DT;
      if (phaseTime <= 0) {
        phase = "wave";
        waveTime = 0;
        log(`第 ${waveIdx + 1} 波开始`);
      }
    }

    // 颜料:自然攒 + 颜料罐
    const boost = phase === "prep" ? INTERMISSION_PAINT_BOOST : 1;
    passive -= DT * boost;
    if (passive <= 0) {
      passive += paintInterval(tech.paint);
      gain(1);
    }
    for (const t of towers.values()) {
      if (t.kind !== "jar") continue;
      t.prod -= DT * boost;
      if (t.prod <= 0) {
        t.prod += jarInterval(tech.paint);
        gain(TOWER_INFO.jar.produce ?? 1);
      }
    }

    // 自动炮台开火
    for (const t of towers.values()) {
      const spec = TOWER_INFO[t.kind];
      const blast = spec.blast;
      if (blast) {
        const cx = colX(t.col);
        const trigger = monsters.some(
          (m) => !m.flying && m.lane === t.lane && Math.abs(m.x - cx) <= blast.trigger
        );
        if (trigger) {
          const dmg = blastDamage(tech.tower);
          for (const m of monsters) {
            if (m.flying || m.lane !== t.lane || Math.abs(m.x - cx) > blast.range) continue;
            const r = applyHit(m, dmg);
            m.hp = r.hp;
            m.armor = r.armor;
          }
          towers.delete(key(t.col, t.lane));
          log(`爆米花桶 (${t.col},${t.lane}) 喷了一大片`);
        }
        continue;
      }
      if (!spec.dmg) continue;
      t.cd -= DT;
      if (t.cd > 0) continue;
      const proj: ProjectileKind = t.kind === "frost" ? "ice" : t.kind === "beam" ? "beam" : "bubble";
      const cx = colX(t.col);
      const target = monsters.some(
        (m) => m.lane === t.lane && m.x >= cx - 0.2 && canHit(proj, m.flying)
      );
      if (!target) continue;
      t.cd = spec.cd ?? 1;
      shots.push({
        x: cx,
        lane: t.lane,
        dmg: towerDamage(t.kind, tech.tower),
        proj,
        slows: !!spec.slows,
        speed: TOWER_SHOT_SPEED,
      });
    }

    // 主角:换道支援最靠前的那只,然后甩颜料弹
    if (doShoot) {
      let targetLane = heroLane;
      let bestX = Infinity;
      for (const m of monsters) {
        if (m.x < bestX) {
          bestX = m.x;
          targetLane = m.lane;
        }
      }
      const step = heroSpeed(tech.hero) * 0.55 * DT;
      if (Math.abs(targetLane - heroLane) <= step) heroLane = targetLane;
      else heroLane += Math.sign(targetLane - heroLane) * step;

      heroCd -= DT;
      const lane = Math.round(heroLane);
      if (heroCd <= 0 && monsters.some((m) => m.lane === lane && m.x >= heroX)) {
        heroCd = heroReload(tech.hero);
        shots.push({
          x: heroX,
          lane,
          dmg: heroDamage(tech.hero),
          proj: "paint",
          slows: false,
          speed: HERO_BULLET_SPEED,
        });
      }
    }

    // 颜料弹飞行与命中
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.speed * DT;
      if (s.x > SPAWN_X + 0.5) {
        shots.splice(i, 1);
        continue;
      }
      let hit: SimMonster | null = null;
      for (const m of monsters) {
        if (m.lane !== s.lane || !canHit(s.proj, m.flying)) continue;
        if (s.x >= m.x - 0.28 && (!hit || m.x < hit.x)) hit = m;
      }
      if (!hit) continue;
      const r = applyHit(hit, s.dmg);
      hit.hp = r.hp;
      hit.armor = r.armor;
      if (s.slows) hit.frost = FROST_SECONDS;
      shots.splice(i, 1);
    }

    // 小怪物:走路 / 啃建筑
    for (const m of monsters) {
      if (m.frost > 0) m.frost -= DT;
      let blockedBy: SimTower | null = null;
      if (!m.flying) {
        for (const t of towers.values()) {
          if (t.lane !== m.lane) continue;
          const cx = colX(t.col);
          if (cx <= m.x + CHEW_REACH && (!blockedBy || cx > colX(blockedBy.col))) blockedBy = t;
        }
      }
      if (blockedBy) {
        if (willJump(m.kind, m.jumped)) {
          m.jumped = true;
          m.x = Math.max(HOME_X + 0.2, colX(blockedBy.col) - 0.8);
          continue;
        }
        m.chewCd -= DT;
        if (m.chewCd <= 0) {
          m.chewCd += chewInterval(m.boss);
          blockedBy.hp -= chewDamage(m.boss);
          if (blockedBy.hp <= 0) towers.delete(key(blockedBy.col, blockedBy.lane));
        }
        continue;
      }
      m.x -= monsterSpeed(m.base, m.frost) * DT;
    }

    // 结算:糊成花花的、溜进家里的
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (m.hp <= 0) {
        monsters.splice(i, 1);
        popped++;
        gain(MONSTER_INFO[m.kind].reward);
        const kids = MONSTER_INFO[m.kind].splits ?? 0;
        for (let k = 0; k < kids; k++) {
          const baby = spawnMonster("doodle", m.lane, idxFor(waveIdx));
          baby.x = Math.min(SPAWN_X, m.x + 0.3 + k * 0.4);
          monsters.push(baby);
        }
        continue;
      }
      if (m.x <= HOME_X) {
        monsters.splice(i, 1);
        leaks[m.lane]++;
        hearts--;
        log(`${MONSTER_INFO[m.kind].name} 从第 ${m.lane + 1} 道溜进来,还剩 ${hearts} 罐颜料`);
        if (hearts <= 0) {
          over = true;
          break;
        }
      }
    }
    if (over) break;

    // 决策
    decide -= DT;
    if (decide <= 0) {
      decide += DECIDE_EVERY;
      let guard = 0;
      while (strategyStep() && guard++ < 6) {
        /* 一次决策最多连买几件,免得钱堆着不花 */
      }
    }
  }

  const waveReached = win ? def.waves.length : Math.min(def.waves.length, waveIdx + 1);
  return {
    win,
    hearts: Math.max(0, hearts),
    homeHp: def.homeHp,
    waveReached,
    waveTotal: def.waves.length,
    time,
    popped,
    leaks,
    paintEarned,
    paintSpent,
    towersBuilt,
    tech,
    stars: campaignStars(Math.max(0, hearts), def.homeHp),
    trace,
  };
}

/** 模拟战役第 levelIdx 关。 */
export function simulateLevel(levelIdx: number, opts: SimOptions = {}): SimResult {
  return simulateRun(LEVELS[levelIdx], levelIdx, opts);
}

/**
 * 模拟无尽 / 合作模式的前 waves 波:把它们拼成一关连着打,
 * 用来确认「越打越难」的曲线在前中期不会突然变成死局。
 */
export function simulateEndless(waves: number, opts: SimOptions & { coop?: boolean } = {}): SimResult {
  const list = [];
  for (let w = 1; w <= waves; w++) list.push(opts.coop ? buildCoopWave(w) : buildEndlessWave(w));
  const def: LevelDef = {
    chapter: 7,
    homeHp: 3,
    startPaint: 10,
    blocked: [],
    boss: null,
    waves: list,
  };
  return simulateRun(def, endlessLevelIndex(1), {
    maxSeconds: 60 * waves + 120,
    ...opts,
    levelIdxFor: (waveIdx) => endlessLevelIndex(waveIdx + 1),
  });
}
