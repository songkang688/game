// 花园守卫 —— 关卡可通关性模拟器(纯逻辑,只给测试用,不依赖 DOM)。
// 用一套固定的"普通小玩家"策略把整关跑完:开局拆路障、先攒经济、
// 对空补针塔、拐角放减速、后期升级,确认 188 关的资源曲线不是死局。
// 模拟比真实运行时保守:射击冷却 ×1.15,不吃连击奖励,不卖塔不微操。

import {
  BarricadeDef,
  BARRICADE_SMASH_REWARD,
  DASH_CYCLE,
  DASH_MULT,
  DASH_TIME,
  ENRAGE_MULT,
  FROST_DURATION,
  HEAL_INTERVAL,
  HEAL_RANGE,
  HEARTS_PER_LEVEL,
  GRID_COLS,
  GRID_ROWS,
  LEVELS,
  MONSTER_INFO,
  MonsterKind,
  SNEAK_HIDDEN,
  SNEAK_VISIBLE,
  SUMMON_INTERVAL,
  TOWER_INFO,
  TowerKind,
  applyHit,
  boomSplash,
  buildWaypoints,
  combineSlow,
  dewSlowFactor,
  effectiveRange,
  frostSlowFactor,
  mistPoisonDamage,
  monsterArmor,
  monsterHp,
  monsterReward,
  pathLength,
  pathsCellSet,
  pickTarget,
  pointAlongPath,
  sunnyInterval,
  towerCanHitAir,
  towerCooldown,
  towerDamage,
  towersUnlockedAt,
  upgradeCost,
  waveSpawnTimes,
  weatherRangeMult,
  weatherSpeedMult,
} from "./logic";

export interface SimOptions {
  /** true = 一座塔都不种(用来验证 BOSS 关也能打输)。 */
  noTowers?: boolean;
  /** 调试:每条事件推入此数组。 */
  trace?: string[];
}

export interface SimResult {
  win: boolean;
  heartsLeft: number;
  timeUsed: number;
  towersBuilt: number;
  towersUpgraded: number;
  petalsLeft: number;
  monstersLeaked: number;
}

interface SimMonster {
  kind: MonsterKind;
  pathIdx: number;
  dist: number;
  baseSpeed: number;
  hp: number;
  maxHp: number;
  armor: number;
  x: number;
  y: number;
  hidden: boolean;
  flying: boolean;
  dashTimer: number;
  dashing: boolean;
  sneakTimer: number;
  healTimer: number;
  summonTimer: number;
  enraged: boolean;
  frostTimer: number;
  frostSlow: number;
}

interface SimTower {
  kind: TowerKind;
  col: number;
  row: number;
  level: number;
  cd: number;
  prodTimer: number;
  coverage: number;
}

const SIM_DT = 0.05;
const SIM_CD_PENALTY = 1.15;
const SIM_TIME_CAP = 900;

/** 固定建造清单:按解锁情况生成,兼顾经济 / 对空 / 减速 / 溅射。 */
function buildPlan(levelIdx: number): TowerKind[] {
  const def = LEVELS[levelIdx];
  const unlocked = towersUnlockedAt(levelIdx, LEVELS);
  const has = (k: TowerKind) => unlocked.includes(k);
  let airCount = 0;
  let groundCount = 0;
  let armoredCount = 0;
  for (const wave of def.waves) {
    for (const e of wave) {
      if (MONSTER_INFO[e.kind].flies) airCount += e.count;
      else groundCount += e.count;
      if (MONSTER_INFO[e.kind].armor > 0) armoredCount += e.count;
    }
  }
  const airHeavy = airCount > groundCount;
  const armorHeavy = armoredCount >= 8;
  const poor = def.startPetals <= 8;
  // 速攻局:路特别短 / 开场就是高速潮 / 双路夹击,先立火力再攒经济。
  const minLen = Math.min(...def.paths.map((p) => pathLength(buildWaypoints(p))));
  let fastRushCount = 0;
  for (const e of def.waves[0]) {
    if (MONSTER_INFO[e.kind].speed * (def.speedMult ?? 1) >= 1.3) fastRushCount += e.count;
  }
  const rush = minLen < 9 || fastRushCount >= 5 || (def.speedMult ?? 1) >= 1.15 || def.paths.length > 1;
  const plan: TowerKind[] = [];
  if (poor && !rush) {
    // 穷开局先立一座便宜的泡泡塔顶住,再攒经济。
    plan.push("bubble");
    if (has("sunny")) plan.push("sunny", "sunny");
    plan.push("needle");
  } else if (rush) {
    plan.push("bubble", "needle", "bubble", "dew");
    if (has("sunny")) plan.push("sunny", "sunny");
  } else {
    if (has("sunny")) plan.push("sunny");
    plan.push("needle", "bubble");
    if (has("sunny")) plan.push("sunny");
  }
  // 重甲局毒雾优先:毒雾无视护甲,是硬壳军团的克星
  if (has("mist") && armorHeavy) plan.push("mist", "mist");
  if (has("frost")) plan.push("frost");
  plan.push("dew");
  if (has("mist") && !airHeavy && !armorHeavy) plan.push("mist");
  if (has("boom") && !airHeavy) plan.push("boom");
  plan.push("needle", "bubble");
  if (has("frost")) plan.push("frost");
  if (has("boom") && groundCount > 0) plan.push("boom");
  plan.push("needle", "dew", "bubble");
  if (has("mist") && groundCount > 0) plan.push("mist");
  plan.push("needle", "bubble", "needle", "bubble", "needle", "bubble");
  return plan;
}

interface SimSpot {
  col: number;
  row: number;
  coverage: number;
  covByPath: number[];
}

/** 所有可种格,按"罩住多少段小路"从好到差排序(结果确定),并记每条路的覆盖量。 */
function rankedSpots(levelIdx: number): SimSpot[] {
  const def = LEVELS[levelIdx];
  const blocked = pathsCellSet(def.paths);
  const samplesByPath: Array<Array<{ x: number; y: number }>> = def.paths.map((path) => {
    const wp = buildWaypoints(path);
    const len = pathLength(wp);
    const out: Array<{ x: number; y: number }> = [];
    for (let d = 0; d <= len; d += 0.25) {
      const p = pointAlongPath(wp, d);
      out.push({ x: p.x, y: p.y });
    }
    return out;
  });
  const refRange = 2.2 * weatherRangeMult(def.weather);
  const spots: SimSpot[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (blocked.has(`${c},${r}`)) continue;
      const covByPath = samplesByPath.map((samples) => {
        let cov = 0;
        for (const s of samples) {
          if (Math.hypot(s.x - (c + 0.5), s.y - (r + 0.5)) <= refRange) cov++;
        }
        return cov;
      });
      const coverage = covByPath.reduce((a, b) => a + b, 0);
      spots.push({ col: c, row: r, coverage, covByPath });
    }
  }
  spots.sort((a, b) => b.coverage - a.coverage || a.row - b.row || a.col - b.col);
  return spots;
}

/** 用固定策略把第 levelIdx 关(0 起)从头打到尾。 */
export function simulateLevel(levelIdx: number, opts: SimOptions = {}): SimResult {
  const def = LEVELS[levelIdx];
  const wpList = def.paths.map((p) => buildWaypoints(p));
  const lenList = wpList.map((wp) => pathLength(wp));
  const weather = def.weather;
  const wSpeed = weatherSpeedMult(weather);

  const spots = rankedSpots(levelIdx);
  const plan = buildPlan(levelIdx);
  const barricades = new Map<string, number>();
  for (const [c, r, hp] of (def.barricades ?? []) as ReadonlyArray<BarricadeDef>) {
    barricades.set(`${c},${r}`, hp);
  }

  const towers: SimTower[] = [];
  const occupied = new Set<string>();
  const monsters: SimMonster[] = [];

  let petals = def.startPetals;
  let hearts = HEARTS_PER_LEVEL;
  let leaked = 0;
  let towersBuilt = 0;
  let towersUpgraded = 0;
  let planIdx = 0;
  const builtCovByPath: number[] = def.paths.map(() => 0);

  let waveIdx = 0;
  let phase: "prewave" | "wave" = "prewave";
  let phaseTimer = 1.6;
  let spawnList = waveSpawnTimes(def.waves[0]);
  let spawnIdx = 0;
  let spawnClock = -0.3;
  let spawnCounter = 0;
  let decisionTimer = 0;
  let time = 0;

  function spawnMonster(kind: MonsterKind, pathIdx: number, dist = 0): void {
    const spec = MONSTER_INFO[kind];
    const p = pointAlongPath(wpList[pathIdx], dist);
    monsters.push({
      kind,
      pathIdx,
      dist,
      baseSpeed: spec.speed * (def.speedMult ?? 1) * wSpeed,
      hp: monsterHp(kind, levelIdx),
      maxHp: monsterHp(kind, levelIdx),
      armor: monsterArmor(kind, levelIdx),
      x: p.x,
      y: p.y,
      hidden: false,
      flying: spec.flies === true,
      // 模拟里用确定性的相位,别引入随机
      dashTimer: DASH_CYCLE * ((spawnCounter % 5) / 5),
      dashing: false,
      sneakTimer: SNEAK_VISIBLE * ((spawnCounter % 3) / 3 + 0.2),
      healTimer: HEAL_INTERVAL,
      summonTimer: SUMMON_INTERVAL,
      enraged: false,
      frostTimer: 0,
      frostSlow: 1,
    });
  }

  function onKilled(m: SimMonster): void {
    petals += monsterReward(m.kind, levelIdx);
    const spec = MONSTER_INFO[m.kind];
    if (spec.splits) {
      spawnMonster("mini", m.pathIdx, Math.max(0, m.dist - 0.2));
      spawnMonster("mini", m.pathIdx, m.dist + 0.15);
    }
  }

  function damage(m: SimMonster, dmg: number): void {
    const res = applyHit(m.hp, m.armor, dmg);
    m.hp = res.hp;
    m.armor = res.armor;
    if (m.hp <= 0) {
      const mi = monsters.indexOf(m);
      if (mi >= 0) monsters.splice(mi, 1);
      onKilled(m);
    }
  }

  /** 毒雾:无视护甲直接掉血,躲起来的也罩得住,但够不着天上的。 */
  function poison(m: SimMonster, dmg: number): void {
    m.hp -= dmg;
    if (m.hp <= 0) {
      const mi = monsters.indexOf(m);
      if (mi >= 0) monsters.splice(mi, 1);
      onKilled(m);
    }
  }

  /** 把 kind 种到最合适的空位:输出塔盯着"火力最薄"的那条路,经济塔缩在角落。 */
  function placeTower(kind: TowerKind): boolean {
    const cost = TOWER_INFO[kind].cost;
    if (petals < cost) return false;
    const free = (s: SimSpot) => {
      const key = `${s.col},${s.row}`;
      return !occupied.has(key) && !barricades.has(key);
    };
    let spot: SimSpot | undefined;
    if (kind === "sunny") {
      spot = [...spots].reverse().find(free);
    } else if (def.paths.length > 1) {
      // 双路图:优先补火力最薄的那条路
      let weakest = 0;
      for (let p = 1; p < builtCovByPath.length; p++) {
        if (builtCovByPath[p] < builtCovByPath[weakest]) weakest = p;
      }
      spot = [...spots]
        .sort((a, b) => b.covByPath[weakest] - a.covByPath[weakest] || b.coverage - a.coverage)
        .find(free);
    } else {
      spot = spots.find(free);
    }
    if (!spot) return false;
    occupied.add(`${spot.col},${spot.row}`);
    opts.trace?.push(`t? build ${kind} @${spot.col},${spot.row} cov=${spot.coverage}`);
    towers.push({
      kind,
      col: spot.col,
      row: spot.row,
      level: 1,
      cd: 0.2,
      prodTimer: sunnyInterval(1),
      coverage: spot.coverage,
    });
    if (kind !== "sunny") {
      for (let p = 0; p < builtCovByPath.length; p++) builtCovByPath[p] += spot.covByPath[p];
    }
    petals -= cost;
    towersBuilt++;
    return true;
  }

  function tryUpgrade(): boolean {
    const candidates = towers
      .filter((t) => t.level < 3 && t.kind !== "sunny")
      .sort((a, b) => b.coverage - a.coverage || a.level - b.level);
    for (const t of candidates) {
      const cost = upgradeCost(t.kind, t.level);
      if (petals >= cost) {
        petals -= cost;
        t.level++;
        towersUpgraded++;
        return true;
      }
    }
    return false;
  }

  function decide(): void {
    if (opts.noTowers) return;
    // 1. 拆掉排名靠前塔位上的路障(小朋友哒哒哒点两下)
    if (barricades.size > 0) {
      for (let i = 0; i < Math.min(spots.length, plan.length + 6); i++) {
        const key = `${spots[i].col},${spots[i].row}`;
        const hp = barricades.get(key);
        if (hp !== undefined) {
          if (hp <= 2) {
            barricades.delete(key);
            petals += BARRICADE_SMASH_REWARD;
          } else {
            barricades.set(key, hp - 2);
          }
          break;
        }
      }
    }
    // 2. 险情应对:有怪快到出口时,立刻补一座打得到它的塔
    const danger = monsters.some((m) => m.dist / lenList[m.pathIdx] > 0.55);
    if (danger) {
      const emergency: TowerKind = monsters.some(
        (m) => m.flying && m.dist / lenList[m.pathIdx] > 0.55,
      )
        ? "needle"
        : "bubble";
      if (petals >= TOWER_INFO[emergency].cost + 3 && placeTower(emergency)) return;
    }
    // 2.5 飞怪在场而对空火力不足:立刻补针塔
    if (monsters.some((m) => m.flying)) {
      const airTowers = towers.filter((t) => towerCanHitAir(t.kind)).length;
      if (airTowers < 4 && petals >= TOWER_INFO.needle.cost && placeTower("needle")) return;
    }
    // 3. 输出塔够 5 座后,升级比铺新塔划算(升级 = 原价+2 换一倍伤害)
    const attackCount = towers.filter((t) => t.kind !== "sunny" && t.kind !== "dew").length;
    if (attackCount >= 5 && tryUpgrade()) return;
    // 4. 按清单建造;当前一项买不起就看看后面有没有买得起的先换上
    if (planIdx < plan.length) {
      if (placeTower(plan[planIdx])) {
        planIdx++;
        return;
      }
      if (danger) {
        for (let j = planIdx + 1; j < Math.min(plan.length, planIdx + 4); j++) {
          if (TOWER_INFO[plan[j]].cost <= petals && placeTower(plan[j])) {
            plan.splice(j, 1);
            return;
          }
        }
      }
      return;
    }
    // 5. 清单造完:先升级,全升满还有余钱就继续铺针塔
    if (tryUpgrade()) return;
    if (petals >= 16) placeTower("needle");
  }

  while (time < SIM_TIME_CAP) {
    time += SIM_DT;
    decisionTimer -= SIM_DT;
    if (decisionTimer <= 0) {
      decisionTimer = 0.25;
      decide();
    }

    if (phase === "prewave") {
      phaseTimer -= SIM_DT;
      if (phaseTimer <= 0) {
        phase = "wave";
        spawnList = waveSpawnTimes(def.waves[waveIdx]);
        spawnIdx = 0;
        spawnClock = -0.3;
      }
    } else {
      spawnClock += SIM_DT;
      while (spawnIdx < spawnList.length && spawnList[spawnIdx].time <= spawnClock) {
        const s = spawnList[spawnIdx++];
        spawnMonster(s.kind, spawnCounter++ % wpList.length);
      }
      if (spawnIdx >= spawnList.length && monsters.length === 0) {
        petals += 3;
        if (waveIdx >= def.waves.length - 1) {
          return {
            win: true,
            heartsLeft: hearts,
            timeUsed: time,
            towersBuilt,
            towersUpgraded,
            petalsLeft: petals,
            monstersLeaked: leaked,
          };
        }
        waveIdx++;
        phase = "prewave";
        phaseTimer = 2.4;
        continue;
      }
    }

    // ---- 怪物行为(与运行时同一套规则) ----
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      const spec = MONSTER_INFO[m.kind];
      if (spec.dashes) {
        m.dashTimer -= SIM_DT;
        if (m.dashTimer <= 0) {
          m.dashing = !m.dashing;
          m.dashTimer = m.dashing ? DASH_TIME : DASH_CYCLE;
        }
      }
      if (spec.sneaks) {
        m.sneakTimer -= SIM_DT;
        if (m.sneakTimer <= 0) {
          m.hidden = !m.hidden;
          m.sneakTimer = m.hidden ? SNEAK_HIDDEN : SNEAK_VISIBLE;
        }
      }
      if (spec.heals) {
        m.healTimer -= SIM_DT;
        if (m.healTimer <= 0) {
          m.healTimer = HEAL_INTERVAL;
          for (const o of monsters) {
            if (o === m || o.hp >= o.maxHp) continue;
            if (Math.hypot(o.x - m.x, o.y - m.y) <= HEAL_RANGE) o.hp = Math.min(o.maxHp, o.hp + 1);
          }
        }
      }
      if (spec.summons) {
        m.summonTimer -= SIM_DT;
        if (m.summonTimer <= 0) {
          m.summonTimer = SUMMON_INTERVAL;
          const kind: MonsterKind = spec.flies ? "flappy" : "mini";
          spawnMonster(kind, m.pathIdx, Math.max(0, m.dist - 0.4));
          spawnMonster(kind, m.pathIdx, Math.max(0, m.dist - 0.8));
        }
      }
      if (spec.enrages && !m.enraged && m.hp <= m.maxHp / 2) m.enraged = true;

      m.frostTimer = Math.max(0, m.frostTimer - SIM_DT);
      const factors: number[] = [];
      if (!m.flying) {
        for (const t of towers) {
          if (t.kind !== "dew") continue;
          const d = Math.hypot(m.x - (t.col + 0.5), m.y - (t.row + 0.5));
          if (d <= effectiveRange("dew", t.level, weather)) factors.push(dewSlowFactor(t.level));
        }
      }
      if (m.frostTimer > 0) factors.push(m.frostSlow);
      let spd = m.baseSpeed * combineSlow(factors);
      if (m.dashing) spd *= DASH_MULT;
      if (m.enraged) spd *= ENRAGE_MULT;
      m.dist += spd * SIM_DT;
      const p = pointAlongPath(wpList[m.pathIdx], m.dist);
      m.x = p.x;
      m.y = p.y;
      if (p.done || m.dist >= lenList[m.pathIdx]) {
        monsters.splice(i, 1);
        hearts--;
        leaked++;
        opts.trace?.push(`t=${time.toFixed(1)} LEAK ${m.kind} hp=${m.hp.toFixed(0)}/${m.maxHp}`);
        if (hearts <= 0) {
          return {
            win: false,
            heartsLeft: 0,
            timeUsed: time,
            towersBuilt,
            towersUpgraded,
            petalsLeft: petals,
            monstersLeaked: leaked,
          };
        }
      }
    }

    // ---- 塔行为 ----
    for (const t of towers) {
      if (t.kind === "dew") continue;
      if (t.kind === "sunny") {
        t.prodTimer -= SIM_DT;
        if (t.prodTimer <= 0) {
          t.prodTimer = sunnyInterval(t.level);
          petals += 1;
        }
        continue;
      }
      t.cd -= SIM_DT;
      if (t.cd > 0) continue;
      const range = effectiveRange(t.kind, t.level, weather);
      if (t.kind === "mist") {
        let hitAny = false;
        for (let mi = monsters.length - 1; mi >= 0; mi--) {
          const m = monsters[mi];
          if (m.flying) continue;
          if (Math.hypot(m.x - (t.col + 0.5), m.y - (t.row + 0.5)) <= range) {
            poison(m, mistPoisonDamage(t.level));
            hitAny = true;
          }
        }
        if (hitAny) t.cd = towerCooldown("mist", t.level) * SIM_CD_PENALTY;
        continue;
      }
      const idx = pickTarget(monsters, t.col + 0.5, t.row + 0.5, range, towerCanHitAir(t.kind));
      if (idx < 0) continue;
      t.cd = towerCooldown(t.kind, t.level) * SIM_CD_PENALTY;
      const target = monsters[idx];
      const dmg = towerDamage(t.kind, t.level);
      if (t.kind === "boom") {
        const hx = target.x;
        const hy = target.y;
        const radius = boomSplash(t.level);
        const inRange = monsters.filter(
          (m) => !m.flying && Math.hypot(m.x - hx, m.y - hy) <= radius,
        );
        for (const m of inRange) damage(m, dmg);
      } else {
        if (t.kind === "frost") {
          target.frostTimer = FROST_DURATION;
          target.frostSlow = frostSlowFactor(t.level);
        }
        damage(target, dmg);
      }
    }
  }

  return {
    win: false,
    heartsLeft: hearts,
    timeUsed: time,
    towersBuilt,
    towersUpgraded,
    petalsLeft: petals,
    monstersLeaked: leaked,
  };
}
