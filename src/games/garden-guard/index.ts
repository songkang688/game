import { meta } from "./meta";
export { meta };

// 花园守卫:188 关十三章主题塔防战役!先选主题再选关,每章专属配色、怪物阵容和 BOSS。
// 通关解锁下一关,回放刷 3 星;失败只重试本关。
// 1.1 新增:冰晶塔/毒雾塔、天上的飞怪、可拆路障、天气影响射程。
import {
  BARRICADE_SMASH_REWARD,
  DASH_CYCLE,
  DASH_MULT,
  DASH_TIME,
  ENRAGE_MULT,
  FROST_DURATION,
  GRID_COLS,
  GRID_ROWS,
  HEAL_INTERVAL,
  HEAL_RANGE,
  HEARTS_PER_LEVEL,
  LEVELS,
  MAX_TOWER_LEVEL,
  MONSTER_INFO,
  MonsterKind,
  PROGRESS_KEY,
  SNEAK_HIDDEN,
  SNEAK_VISIBLE,
  SUMMON_INTERVAL,
  THEME_ORDER,
  THEME_STYLE,
  TOWER_INFO,
  TowerKind,
  WEATHER_INFO,
  applyHit,
  barricadeMap,
  boomSplash,
  buildWaypoints,
  canPlace,
  clearSpeechLine,
  combineSlow,
  comboPetalBonus,
  dewSlowFactor,
  effectiveRange,
  frostSlowFactor,
  isLevelUnlocked,
  isThemeUnlocked,
  mistPoisonDamage,
  monsterArmor,
  monsterHp,
  monsterReward,
  parseProgress,
  pathLength,
  pathsCellSet,
  pickTarget,
  pointAlongPath,
  retrySpeechLine,
  sellRefund,
  serializeProgress,
  starsForLevel,
  sunnyInterval,
  themeCleared,
  themeIndexOfLevel,
  themeOffset,
  themeSize,
  themeStars,
  totalStars,
  towerCanHitAir,
  towerCooldown,
  towerDamage,
  towerRange,
  towersUnlockedAt,
  upgradeCost,
  waveSpawnTimes,
  weatherSpeedMult,
  type LevelDef,
} from "./logic";
import { speak, stopSpeaking } from "../speech";
import { save } from "../../engine/save";
import {
  FIXED_STEP,
  THREAT_LABEL,
  bestWave,
  buildEndlessLevel,
  earlyCallBonus,
  endlessLine,
  endlessPetalGrant,
  nextSpeed,
  planSteps,
  previewAdvice,
  speedLabel,
  wavePreview,
} from "./defense12";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export interface GameAPI {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

const HUD_H = 44;
const TOOLBAR_H = 58;

type Phase = "themes" | "map" | "intro" | "prewave" | "wave" | "clear" | "retry";

interface Monster {
  kind: MonsterKind;
  pathIdx: number;
  dist: number;
  baseSpeed: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  x: number;
  y: number;
  wob: number;
  slowed: boolean;
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

interface Tower {
  kind: TowerKind;
  col: number;
  row: number;
  level: number;
  cd: number;
  prodTimer: number;
  firedAnim: number;
}

interface Bullet {
  x: number;
  y: number;
  target: Monster | null;
  life: number;
  dmg: number;
  speed: number;
  needle: boolean;
  splash: number;
  /** 冰晶弹:命中后目标的减速倍率(undefined = 普通弹) */
  frostSlow?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  r: number;
}

interface Floaty {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  big: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function loadProgress(): number[] {
  try {
    return parseProgress(localStorage.getItem(PROGRESS_KEY), LEVELS.length);
  } catch {
    return parseProgress(null, LEVELS.length);
  }
}

function saveProgress(stars: number[]): void {
  try {
    localStorage.setItem(PROGRESS_KEY, serializeProgress(stars));
  } catch {
    // 存储被禁用时静默失败
  }
}

export function mount(api: GameAPI): { destroy: () => void } {
  const { root } = api;
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  // ---- 战役进度 ----
  const progress = loadProgress();

  // ---- 局状态 ----
  let levelIdx = 0;
  let chapterIdx = 0;
  let phase: Phase = "themes";
  let phaseTimer = 0;
  let waveIdx = 0;
  let petals = LEVELS[0].startPetals;
  let hearts = HEARTS_PER_LEVEL;
  let score = 0;
  let combo = 0;
  let comboTimer = 0;
  let heartsLost = 0;
  let earnedStars: 1 | 2 | 3 = 1;
  let finaleFired = false;
  let destroyed = false;
  let petalFlash = 0;
  let shake = 0;
  let time = 0;

  /** 1.2 播放倍速与固定步长的余量 */
  let speed = 1;
  let stepCarry = 0;
  /** 非 null 时正在跑无尽「守到底」 */
  let endless: { wave: number; seed: number } | null = null;
  /** 无尽模式下临时拼出来的一关（复用整套战役画面与操作） */
  let endlessDef: LevelDef | null = null;
  let endlessBest = save.getGameProgress("garden-guard").endlessBest;
  let btnSpeed: Rect | null = null;
  let btnCallNow: Rect | null = null;
  let btnEndless: Rect | null = null;

  /** 当前这一关的数据：无尽模式给临时关，闯关给 LEVELS 里的那一关 */
  function curDef(): LevelDef {
    return endlessDef ?? LEVELS[levelIdx];
  }

  let wpList = LEVELS[0].paths.map((p) => buildWaypoints(p));
  let lenList = wpList.map((wp) => pathLength(wp));
  let blocked = pathsCellSet(LEVELS[0].paths);
  const occupied = new Map<string, Tower>();
  let barricades = barricadeMap(LEVELS[0].barricades);

  const monsters: Monster[] = [];
  const towers: Tower[] = [];
  const bullets: Bullet[] = [];
  const particles: Particle[] = [];
  const floats: Floaty[] = [];

  let spawnList: Array<{ kind: MonsterKind; time: number }> = [];
  let spawnIdx = 0;
  let spawnClock = 0;
  let spawnCounter = 0;

  let unlockedTowers: TowerKind[] = towersUnlockedAt(0, LEVELS);
  let selectedCard: TowerKind = "bubble";
  let selectedTower: Tower | null = null;
  let panelUpgrade: Rect | null = null;
  let panelSell: Rect | null = null;
  const cardRects: Array<{ kind: TowerKind; rect: Rect }> = [];
  const mapNodes: Array<{ idx: number; x: number; y: number; r: number }> = [];
  const themeCards: Array<{ idx: number; rect: Rect }> = [];
  let btnNext: Rect | null = null;
  let btnMap: Rect | null = null;
  let btnRetry: Rect | null = null;
  let btnBack: Rect = { x: 0, y: 0, w: 0, h: 0 };

  // ---- 布局 ----
  let w = 640;
  let h = 480;
  let cell = 48;
  let ox = 0;
  let oy = HUD_H + TOOLBAR_H;

  function syncSize(): void {
    w = root.clientWidth || 640;
    h = root.clientHeight || 480;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(1, Math.round(w * dpr));
    const bh = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = HUD_H + TOOLBAR_H;
    cell = Math.min(w / GRID_COLS, (h - top) / GRID_ROWS);
    ox = (w - cell * GRID_COLS) / 2;
    oy = top + (h - top - cell * GRID_ROWS) / 2;
  }

  const px = (cx: number) => ox + cx * cell;
  const py = (cy: number) => oy + cy * cell;

  function burst(x: number, y: number, color: string, n = 8, power = 1): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random();
      particles.push({
        x,
        y,
        vx: Math.cos(a) * (40 + Math.random() * 60) * power,
        vy: Math.sin(a) * (40 + Math.random() * 60) * power,
        life: 0.5,
        color,
        r: 3 + Math.random() * 3,
      });
    }
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.1 : 0.85, big });
  }

  // ---- 关卡流程 ----
  /** 换一份关卡数据：路径、可放格、已解锁的塔都要跟着换 */
  function applyDef(def: LevelDef, towerList: TowerKind[]): void {
    wpList = def.paths.map((p) => buildWaypoints(p));
    lenList = wpList.map((wp) => pathLength(wp));
    blocked = pathsCellSet(def.paths);
    unlockedTowers = towerList;
    if (!unlockedTowers.includes(selectedCard)) selectedCard = "bubble";
  }

  /**
   * 无尽「守到底」：一波接一波，塔和花瓣全程带着走，只有爱心掉光才结束。
   *
   * 每一波都现拼一份「只有一波的关卡」丢给战役那套画面，
   * 所以无尽不需要另写渲染，也不会和 188 关的进度互相污染。
   */
  function loadEndlessWave(wave: number): void {
    if (!endless) return;
    endless.wave = wave;
    endlessDef = buildEndlessLevel(wave, endless.seed);
    chapterIdx = THEME_ORDER.indexOf(endlessDef.theme);
    if (chapterIdx < 0) chapterIdx = 0;
    applyDef(endlessDef, towersUnlockedAt(LEVELS.length - 1, LEVELS));
    waveIdx = 0;
    spawnList = [];
    spawnIdx = 0;
    spawnClock = 0;
    // 换路线时把老怪清掉，免得它们沿着已经不存在的路走
    monsters.length = 0;
    bullets.length = 0;
  }

  function startEndless(): void {
    endless = { wave: 1, seed: 733 };
    endlessDef = buildEndlessLevel(1, endless.seed);
    loadEndlessWave(1);
    resetLevel();
    phase = "intro";
  }

  /** 无尽里守住一波：给花瓣、换下一波，不结算不记星 */
  function endlessWaveCleared(): void {
    if (!endless) return;
    const grant = endlessPetalGrant(endless.wave);
    petals += grant;
    addFloat(w / 2, oy + 40, `守住第 ${endless.wave} 波 +${grant} 🌸`, "#e05a7a", true);
    score += endless.wave * 5;
    loadEndlessWave(endless.wave + 1);
    phase = "prewave";
    phaseTimer = 6;
    api.play("jump");
  }

  /** 无尽结束：记成绩，面板只鼓励 */
  function endlessOver(): void {
    if (!endless) return;
    const reached = Math.max(0, endless.wave - 1);
    endlessBest = bestWave(endlessBest, reached);
    save.recordEndlessBest("garden-guard", reached);
    phase = "retry";
    api.play("oops");
    speak(endlessLine(reached, endlessBest));
  }

  function loadLevel(idx: number): void {
    endless = null;
    endlessDef = null;
    levelIdx = idx;
    chapterIdx = themeIndexOfLevel(idx);
    applyDef(LEVELS[idx], towersUnlockedAt(idx, LEVELS));
    resetLevel();
    phase = "intro";
  }

  function resetLevel(): void {
    const def = curDef();
    monsters.length = 0;
    bullets.length = 0;
    towers.length = 0;
    occupied.clear();
    barricades = barricadeMap(def.barricades);
    petals = def.startPetals;
    hearts = HEARTS_PER_LEVEL;
    heartsLost = 0;
    waveIdx = 0;
    combo = 0;
    score = 0;
    selectedTower = null;
    spawnList = [];
    spawnIdx = 0;
    spawnClock = 0;
    spawnCounter = 0;
  }

  function startWave(): void {
    spawnList = waveSpawnTimes(curDef().waves[waveIdx]);
    spawnIdx = 0;
    spawnClock = -0.3;
    phase = "wave";
  }

  function levelCleared(): void {
    earnedStars = starsForLevel(heartsLost);
    const prev = progress[levelIdx] ?? 0;
    const gained = Math.max(0, earnedStars - prev);
    progress[levelIdx] = Math.max(prev, earnedStars);
    saveProgress(progress);
    phase = "clear";
    api.play("win");
    if (levelIdx >= LEVELS.length - 1 && !finaleFired) {
      finaleFired = true;
      api.onWin(earnedStars, `188 关十三章战役全部通关!星尘魔王也被请回家啦!总星 ${totalStars(progress)}/${LEVELS.length * 3}`);
    } else {
      // 结算面板自动朗读(终局走平台弹窗,那边自带朗读,不叠音)
      speak(clearSpeechLine(curDef().name, earnedStars));
      if (gained > 0) {
        api.addStars(gained);
        addFloat(w / 2, h / 2 - 110, `+${gained} ⭐`, "#e0a030", true);
      }
    }
  }

  // ---- 输入 ----
  function inRect(x: number, y: number, r: Rect | null): boolean {
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function onPointerDown(e: PointerEvent): void {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (phase === "themes") {
      if (inRect(x, y, btnEndless)) {
        api.play("tap");
        startEndless();
        return;
      }
      for (const c of themeCards) {
        if (inRect(x, y, c.rect)) {
          if (isThemeUnlocked(progress, c.idx)) {
            api.play("tap");
            chapterIdx = c.idx;
            phase = "map";
          } else {
            api.play("oops");
          }
          return;
        }
      }
      return;
    }
    if (phase === "map") {
      if (inRect(x, y, btnBack)) {
        api.play("tap");
        phase = "themes";
        return;
      }
      for (const n of mapNodes) {
        if (Math.hypot(x - n.x, y - n.y) <= n.r + 6) {
          if (isLevelUnlocked(progress, n.idx)) {
            api.play("tap");
            loadLevel(n.idx);
          } else {
            api.play("oops");
          }
          return;
        }
      }
      return;
    }
    if (phase === "intro") {
      if (inRect(x, y, btnBack)) {
        api.play("tap");
        phase = endless ? "themes" : "map";
        return;
      }
      api.play("tap");
      phase = "prewave";
      // 无尽第一波多给几秒:一座塔都还没有,不能一开门就来怪
      phaseTimer = endless ? 6 : 1.6;
      return;
    }
    if (phase === "clear") {
      if (inRect(x, y, btnNext) && levelIdx < LEVELS.length - 1) {
        api.play("tap");
        stopSpeaking();
        loadLevel(levelIdx + 1);
        return;
      }
      if (inRect(x, y, btnMap)) {
        api.play("tap");
        stopSpeaking();
        phase = "map";
      }
      return;
    }
    if (phase === "retry") {
      if (inRect(x, y, btnRetry)) {
        api.play("tap");
        stopSpeaking();
        if (endless) {
          startEndless();
          phase = "prewave";
          phaseTimer = 6;
        } else {
          resetLevel();
          phase = "prewave";
          phaseTimer = 1.6;
        }
        return;
      }
      if (inRect(x, y, btnMap)) {
        api.play("tap");
        stopSpeaking();
        phase = endless ? "themes" : "map";
      }
      return;
    }

    // 玩关卡时左上角随时回地图
    if (inRect(x, y, btnBack)) {
      api.play("tap");
      phase = endless ? "themes" : "map";
      return;
    }

    // 倍速:布阵和打波次时都能切,切完立刻生效
    if (inRect(x, y, btnSpeed)) {
      speed = nextSpeed(speed);
      api.play("tap");
      return;
    }

    // 提前召唤下一波:早叫几秒就多几片花瓣
    if (phase === "prewave" && inRect(x, y, btnCallNow)) {
      const bonus = earlyCallBonus(phaseTimer);
      petals += bonus;
      if (bonus > 0) addFloat(w / 2, oy + 60, `提前召唤 +${bonus} 🌸`, "#c47a2a", true);
      api.play("coin");
      phaseTimer = 0;
      startWave();
      return;
    }

    // 工具栏选卡
    for (const c of cardRects) {
      if (inRect(x, y, c.rect)) {
        selectedCard = c.kind;
        selectedTower = null;
        api.play("tap");
        return;
      }
    }

    // 塔操作面板
    if (selectedTower) {
      const t = selectedTower;
      if (inRect(x, y, panelUpgrade) && t.level < MAX_TOWER_LEVEL) {
        const cost = upgradeCost(t.kind, t.level);
        if (petals >= cost) {
          petals -= cost;
          t.level++;
          api.play("coin");
          burst(px(t.col + 0.5), py(t.row + 0.5), "#ffe387", 12);
          addFloat(px(t.col + 0.5), py(t.row), `升到 ${t.level} 级!`, "#c47a2a");
        } else {
          petalFlash = 0.8;
          api.play("tap");
        }
        return;
      }
      if (inRect(x, y, panelSell)) {
        const refund = sellRefund(t.kind, t.level);
        petals += refund;
        occupied.delete(`${t.col},${t.row}`);
        const ti = towers.indexOf(t);
        if (ti >= 0) towers.splice(ti, 1);
        selectedTower = null;
        api.play("coin");
        addFloat(px(t.col + 0.5), py(t.row + 0.5), `+${refund} 🌸`, "#e05a7a");
        return;
      }
    }

    const col = Math.floor((x - ox) / cell);
    const row = Math.floor((y - oy) / cell);
    const key = `${col},${row}`;

    const existing = occupied.get(key);
    if (existing) {
      selectedTower = selectedTower === existing ? null : existing;
      api.play("tap");
      return;
    }
    selectedTower = null;

    // 路障:点一下敲掉 1 点耐久,敲碎才腾出塔位(还奖励 1 花瓣)
    const barrHp = barricades.get(key);
    if (barrHp !== undefined) {
      if (barrHp <= 1) {
        barricades.delete(key);
        petals += BARRICADE_SMASH_REWARD;
        api.play("pop");
        burst(px(col + 0.5), py(row + 0.5), "#c9a86a", 14, 1.2);
        addFloat(px(col + 0.5), py(row), `拆掉啦!+${BARRICADE_SMASH_REWARD}🌸`, "#c47a2a");
      } else {
        barricades.set(key, barrHp - 1);
        api.play("tap");
        burst(px(col + 0.5), py(row + 0.5), "#d8c8a8", 6, 0.6);
        shake = 0.12;
      }
      return;
    }

    if (!canPlace(col, row, blocked, new Set(occupied.keys()))) {
      api.play("tap");
      return;
    }
    const cost = TOWER_INFO[selectedCard].cost;
    if (petals < cost) {
      petalFlash = 0.8;
      api.play("tap");
      return;
    }
    petals -= cost;
    const tw: Tower = {
      kind: selectedCard,
      col,
      row,
      level: 1,
      cd: 0.2,
      prodTimer: sunnyInterval(1),
      firedAnim: 0,
    };
    occupied.set(key, tw);
    towers.push(tw);
    api.play("pop");
    burst(px(col + 0.5), py(row + 0.5), "#ffd6e7", 10);
  }

  // ---- 怪物生成与死亡 ----
  function spawnMonster(kind: MonsterKind, pathIdx: number, dist = 0): void {
    const spec = MONSTER_INFO[kind];
    const hp = monsterHp(kind, levelIdx);
    const armor = monsterArmor(kind, levelIdx);
    const wp = wpList[pathIdx];
    const p = pointAlongPath(wp, dist);
    monsters.push({
      kind,
      pathIdx,
      dist,
      baseSpeed: spec.speed * (curDef().speedMult ?? 1) * weatherSpeedMult(curDef().weather),
      hp,
      maxHp: hp,
      armor,
      maxArmor: armor,
      x: p.x,
      y: p.y,
      wob: Math.random() * Math.PI * 2,
      slowed: false,
      hidden: false,
      flying: spec.flies === true,
      dashTimer: DASH_CYCLE * Math.random(),
      dashing: false,
      sneakTimer: SNEAK_VISIBLE * Math.random(),
      healTimer: HEAL_INTERVAL,
      summonTimer: SUMMON_INTERVAL,
      enraged: false,
      frostTimer: 0,
      frostSlow: 1,
    });
  }

  function onMonsterKilled(m: Monster): void {
    const spec = MONSTER_INFO[m.kind];
    petals += monsterReward(m.kind, levelIdx);
    combo++;
    comboTimer = 2.2;
    const gain = 10 + (Math.min(combo, 8) - 1) * 5;
    score += gain;
    const bonus = comboPetalBonus(combo);
    if (bonus > 0) {
      petals += bonus;
      addFloat(px(m.x), py(m.y) - 22, `连击 ×${combo} +${bonus}🌸`, "#b28ae8", true);
      api.play("coin");
    } else {
      api.play(spec.boss ? "win" : "coin");
    }
    addFloat(px(m.x), py(m.y), `+${gain}`, "#c47a2a");
    burst(px(m.x), py(m.y), "#c9b6f2", spec.boss ? 26 : 12, spec.boss ? 1.8 : 1);
    if (spec.splits) {
      spawnMonster("mini", m.pathIdx, Math.max(0, m.dist - 0.2));
      spawnMonster("mini", m.pathIdx, m.dist + 0.15);
      addFloat(px(m.x), py(m.y) - 30, "分身!", "#b28ae8");
    }
    if (spec.boss) {
      addFloat(px(m.x), py(m.y) - 40, `${spec.name} 打倒啦!`, "#e05a7a", true);
      shake = 0.5;
    }
  }

  function damageMonster(m: Monster, dmg: number): void {
    const res = applyHit(m.hp, m.armor, dmg);
    m.hp = res.hp;
    m.armor = res.armor;
    if (res.brokeArmor) {
      api.play("meow");
      addFloat(px(m.x), py(m.y) - 18, "壳碎啦!", "#c47a2a");
    }
    if (m.hp <= 0) {
      const mi = monsters.indexOf(m);
      if (mi >= 0) monsters.splice(mi, 1);
      onMonsterKilled(m);
    }
  }

  // ---- 更新 ----
  function update(dt: number): void {
    const def = curDef();
    time += dt;
    petalFlash = Math.max(0, petalFlash - dt);
    shake = Math.max(0, shake - dt);
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y -= dt * 34;
      if (f.life <= 0) floats.splice(i, 1);
    }

    if (phase === "prewave") {
      phaseTimer -= dt;
      if (phaseTimer <= 0) startWave();
    } else if (phase === "wave") {
      spawnClock += dt;
      while (spawnIdx < spawnList.length && spawnList[spawnIdx].time <= spawnClock) {
        const s = spawnList[spawnIdx++];
        spawnMonster(s.kind, spawnCounter++ % wpList.length);
      }
      if (spawnIdx >= spawnList.length && monsters.length === 0) {
        if (endless) {
          endlessWaveCleared();
          return;
        }
        petals += 3;
        addFloat(w / 2, oy + 40, "波次奖励 +3 🌸", "#e05a7a", true);
        if (waveIdx >= curDef().waves.length - 1) {
          levelCleared();
        } else {
          waveIdx++;
          phase = "prewave";
          phaseTimer = 2.4;
          api.play("jump");
        }
        return;
      }
    }

    if (phase !== "wave" && phase !== "prewave") return;

    // 怪物行为(由 MonsterSpec 行为开关驱动,BOSS 可组合多个技能)
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      const mSpec = MONSTER_INFO[m.kind];
      // 周期冲刺
      if (mSpec.dashes) {
        m.dashTimer -= dt;
        if (m.dashTimer <= 0) {
          m.dashing = !m.dashing;
          m.dashTimer = m.dashing ? DASH_TIME : DASH_CYCLE;
          if (m.dashing) burst(px(m.x), py(m.y), "#ffd868", 5, 0.6);
        }
      }
      // 周期隐身
      if (mSpec.sneaks) {
        m.sneakTimer -= dt;
        if (m.sneakTimer <= 0) {
          m.hidden = !m.hidden;
          m.sneakTimer = m.hidden ? SNEAK_HIDDEN : SNEAK_VISIBLE;
        }
      }
      // 治疗附近
      if (mSpec.heals) {
        m.healTimer -= dt;
        if (m.healTimer <= 0) {
          m.healTimer = HEAL_INTERVAL;
          for (const o of monsters) {
            if (o === m || o.hp >= o.maxHp) continue;
            if (Math.hypot(o.x - m.x, o.y - m.y) <= HEAL_RANGE) {
              o.hp = Math.min(o.maxHp, o.hp + 1);
              addFloat(px(o.x), py(o.y) - 14, "+1", "#7ac97a");
            }
          }
          burst(px(m.x), py(m.y), "#d8f5d8", 6, 0.5);
        }
      }
      // 召唤小兵(飞天 BOSS 召唤的也是飞飞怪)
      if (mSpec.summons) {
        m.summonTimer -= dt;
        if (m.summonTimer <= 0) {
          m.summonTimer = SUMMON_INTERVAL;
          const minion: MonsterKind = mSpec.flies ? "flappy" : "mini";
          spawnMonster(minion, m.pathIdx, Math.max(0, m.dist - 0.4));
          spawnMonster(minion, m.pathIdx, Math.max(0, m.dist - 0.8));
          addFloat(px(m.x), py(m.y) - 30, "召唤小兵!", "#e05a7a");
          api.play("meow");
        }
      }
      // 半血暴走
      if (mSpec.enrages && !m.enraged && m.hp <= m.maxHp / 2) {
        m.enraged = true;
        shake = 0.4;
        addFloat(px(m.x), py(m.y) - 34, `${mSpec.name}暴走啦!`, "#5a8ac9", true);
        api.play("oops");
      }

      // 减速:露珠光环(只管地面)+ 冰晶弹命中减速
      m.frostTimer = Math.max(0, m.frostTimer - dt);
      const factors: number[] = [];
      if (!m.flying) {
        for (const t of towers) {
          if (t.kind !== "dew") continue;
          const d = Math.hypot(m.x - (t.col + 0.5), m.y - (t.row + 0.5));
          if (d <= effectiveRange("dew", t.level, def.weather)) factors.push(dewSlowFactor(t.level));
        }
      }
      if (m.frostTimer > 0) factors.push(m.frostSlow);
      const factor = combineSlow(factors);
      m.slowed = factor < 1;
      let spd = m.baseSpeed * factor;
      if (m.dashing) spd *= DASH_MULT;
      if (m.enraged) spd *= ENRAGE_MULT;
      m.dist += spd * dt;
      m.wob += dt * 7;
      const wp = wpList[m.pathIdx];
      const p = pointAlongPath(wp, m.dist);
      m.x = p.x;
      m.y = p.y;
      if (p.done || m.dist >= lenList[m.pathIdx]) {
        monsters.splice(i, 1);
        hearts--;
        heartsLost++;
        shake = 0.35;
        api.play("oops");
        burst(px(m.x), py(m.y), "#ff9eb5", 14);
        if (hearts <= 0) {
          if (endless) {
            endlessOver();
            return;
          }
          phase = "retry";
          api.play("oops");
          speak(retrySpeechLine(bossFailHint()));
          return;
        }
      }
    }

    // 塔行为
    for (const t of towers) {
      t.firedAnim = Math.max(0, t.firedAnim - dt * 4);
      if (t.kind === "dew") continue;
      if (t.kind === "sunny") {
        t.prodTimer -= dt;
        if (t.prodTimer <= 0) {
          t.prodTimer = sunnyInterval(t.level);
          petals += 1;
          t.firedAnim = 1;
          api.play("coin");
          addFloat(px(t.col + 0.5), py(t.row), "+1🌸", "#e0a030");
        }
        continue;
      }
      t.cd -= dt;
      if (t.cd <= 0) {
        const range = effectiveRange(t.kind, t.level, def.weather);
        if (t.kind === "mist") {
          // 毒雾塔:周期毒雾脉冲,罩住射程内所有地面怪(无视护甲,连隐身怪也躲不掉)
          let hitAny = false;
          const dmg = mistPoisonDamage(t.level);
          for (let mi = monsters.length - 1; mi >= 0; mi--) {
            const m = monsters[mi];
            if (m.flying) continue;
            if (Math.hypot(m.x - (t.col + 0.5), m.y - (t.row + 0.5)) <= range) {
              hitAny = true;
              m.hp -= dmg;
              if (m.hp <= 0) {
                monsters.splice(mi, 1);
                onMonsterKilled(m);
              }
            }
          }
          if (hitAny) {
            t.cd = towerCooldown("mist", t.level);
            t.firedAnim = 1;
            burst(px(t.col + 0.5), py(t.row + 0.5), "#b5d8a8", 10, 0.9);
          }
          continue;
        }
        const idx = pickTarget(monsters, t.col + 0.5, t.row + 0.5, range, towerCanHitAir(t.kind));
        if (idx >= 0) {
          t.cd = towerCooldown(t.kind, t.level);
          t.firedAnim = 1;
          bullets.push({
            x: t.col + 0.5,
            y: t.row + 0.5,
            target: monsters[idx],
            life: 2,
            dmg: towerDamage(t.kind, t.level),
            speed: t.kind === "needle" ? 12 : t.kind === "boom" ? 5 : t.kind === "frost" ? 8 : 6,
            needle: t.kind === "needle",
            splash: t.kind === "boom" ? boomSplash(t.level) : 0,
            frostSlow: t.kind === "frost" ? frostSlowFactor(t.level) : undefined,
          });
        }
      }
    }

    // 子弹飞行
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      const tgt = b.target;
      if (!tgt || tgt.hp <= 0 || b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }
      const dx = tgt.x - b.x;
      const dy = tgt.y - b.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const step = b.speed * dt;
      if (d <= Math.max(0.22, step)) {
        bullets.splice(i, 1);
        if (b.splash > 0) {
          burst(px(tgt.x), py(tgt.y), "#ffc09b", 16, 1.4);
          api.play("pop");
          const hitX = tgt.x;
          const hitY = tgt.y;
          // 花火溅射只炸地面(天上的飞怪炸不到)
          const inRange = monsters.filter(
            (m) => !m.flying && Math.hypot(m.x - hitX, m.y - hitY) <= b.splash,
          );
          for (const m of inRange) damageMonster(m, b.dmg);
        } else {
          burst(px(tgt.x), py(tgt.y), b.needle ? "#c8f2d8" : b.frostSlow !== undefined ? "#cfeafc" : "#bfe9ff", 6);
          if (b.frostSlow !== undefined) {
            tgt.frostTimer = FROST_DURATION;
            tgt.frostSlow = b.frostSlow;
          }
          damageMonster(tgt, b.dmg);
          if (tgt.hp > 0) api.play("pop");
        }
      } else {
        b.x += (dx / d) * step;
        b.y += (dy / d) * step;
      }
    }
  }

  // ---- 绘制 ----
  /** 把 #rrggbb 变深/变浅(amt 为 -255..255) */
  function shade(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawFace(x: number, y: number, r: number, blush = true): void {
    if (blush) {
      ctx.fillStyle = "rgba(255,150,160,0.4)";
      ctx.beginPath();
      ctx.arc(x - r * 0.52, y + r * 0.12, r * 0.16, 0, Math.PI * 2);
      ctx.arc(x + r * 0.52, y + r * 0.12, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.arc(x + r * 0.32, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.13, r * 0.035, 0, Math.PI * 2);
    ctx.arc(x + r * 0.29, y - r * 0.13, r * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y + r * 0.15, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  /** 已种下的植物底座:小土丘 + 两片叶子,让"这是种在土里的植物"一目了然 */
  function drawTowerBase(tx: number, ty: number, r: number): void {
    ctx.fillStyle = "rgba(58,58,74,0.12)";
    ctx.beginPath();
    ctx.ellipse(tx, ty + r * 1.15, r * 1.05, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b98c62";
    ctx.beginPath();
    ctx.ellipse(tx, ty + r * 1.05, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a3764e";
    ctx.beginPath();
    ctx.ellipse(tx, ty + r * 1.02, r * 0.62, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 两片小叶子
    ctx.fillStyle = "#8fd8a8";
    ctx.beginPath();
    ctx.ellipse(tx - r * 0.72, ty + r * 0.88, r * 0.3, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.ellipse(tx + r * 0.72, ty + r * 0.88, r * 0.3, r * 0.14, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTowerIcon(kind: TowerKind, tx: number, ty: number, r: number, level = 1, anim = 0): void {
    ctx.save();
    ctx.lineJoin = "round";
    if (kind === "bubble") {
      const squish = 1 + anim * 0.15;
      ctx.fillStyle = "#fff7f0";
      ctx.strokeStyle = "#e8b8c8";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(tx, ty + r * 0.35, r * 0.55, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const bodyGrad = ctx.createRadialGradient(tx - r * 0.3, ty - r * 0.5, r * 0.1, tx, ty - r * 0.25, r * 1.1);
      bodyGrad.addColorStop(0, "#ffc3d4");
      bodyGrad.addColorStop(1, "#ff8aa8");
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = "#e87a9a";
      ctx.beginPath();
      ctx.ellipse(tx, ty - r * 0.25, r * squish, r * 0.75 * squish, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const [dx2, dy2] of [
        [-0.45, -0.3],
        [0.35, -0.5],
        [0.1, 0.05],
      ]) {
        ctx.beginPath();
        ctx.arc(tx + dx2 * r, ty - r * 0.25 + dy2 * r, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
      drawFace(tx, ty + r * 0.4, r * 0.55);
    } else if (kind === "needle") {
      ctx.strokeStyle = "#5aa878";
      ctx.lineWidth = Math.max(1.5, r * 0.11);
      ctx.lineCap = "round";
      const spikes = 6;
      for (let i = 0; i < spikes; i++) {
        const a = (Math.PI * 2 * i) / spikes + anim * 0.5;
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(a) * r * 0.62, ty + Math.sin(a) * r * 0.8);
        ctx.lineTo(tx + Math.cos(a) * r * (0.9 + anim * 0.2), ty + Math.sin(a) * r * (1.1 + anim * 0.2));
        ctx.stroke();
      }
      const cactusGrad = ctx.createLinearGradient(tx, ty - r, tx, ty + r);
      cactusGrad.addColorStop(0, "#a8e8bc");
      cactusGrad.addColorStop(1, "#76c894");
      ctx.fillStyle = cactusGrad;
      ctx.strokeStyle = "#4e9a6a";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(tx, ty, r * 0.62, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 仙人掌花
      ctx.fillStyle = "#ffb3c8";
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(tx + Math.cos(a) * r * 0.18, ty - r * 0.85 + Math.sin(a) * r * 0.18, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe387";
      ctx.beginPath();
      ctx.arc(tx, ty - r * 0.85, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      drawFace(tx, ty, r * 0.55);
    } else if (kind === "dew") {
      const dewGrad = ctx.createLinearGradient(tx, ty - r, tx, ty + r);
      dewGrad.addColorStop(0, "#c8ecfc");
      dewGrad.addColorStop(1, "#7ec4ea");
      ctx.fillStyle = dewGrad;
      ctx.strokeStyle = "#5aa0cc";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(tx, ty - r * 0.95);
      ctx.quadraticCurveTo(tx + r * 0.75, ty - r * 0.05, tx + r * 0.6, ty + r * 0.4);
      ctx.arc(tx, ty + r * 0.28, r * 0.62, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.quadraticCurveTo(tx - r * 0.75, ty - r * 0.05, tx, ty - r * 0.95);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.ellipse(tx - r * 0.24, ty - r * 0.1, r * 0.12, r * 0.2, -0.4, 0, Math.PI * 2);
      ctx.fill();
      drawFace(tx, ty + r * 0.25, r * 0.5);
    } else if (kind === "sunny") {
      // 阳光花:黄色花瓣圈
      ctx.fillStyle = "#ffe387";
      ctx.strokeStyle = "#f2c24e";
      ctx.lineWidth = Math.max(1, r * 0.06);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + anim * 0.4;
        ctx.beginPath();
        ctx.ellipse(tx + Math.cos(a) * r * 0.62, ty + Math.sin(a) * r * 0.62, r * 0.3, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      const coreGrad = ctx.createRadialGradient(tx - r * 0.15, ty - r * 0.15, r * 0.05, tx, ty, r * 0.7);
      coreGrad.addColorStop(0, "#ffe9a8");
      coreGrad.addColorStop(1, "#ffc94e");
      ctx.fillStyle = coreGrad;
      ctx.strokeStyle = "#e8a830";
      ctx.beginPath();
      ctx.arc(tx, ty, r * (0.55 + anim * 0.1), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawFace(tx, ty, r * 0.5);
    } else if (kind === "frost") {
      // 冰晶塔:六角小冰花
      ctx.strokeStyle = "#8ac8ea";
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * i) / 3 + anim * 0.4;
        ctx.beginPath();
        ctx.moveTo(tx, ty - r * 0.1);
        ctx.lineTo(tx + Math.cos(a) * r * 0.9, ty - r * 0.1 + Math.sin(a) * r * 0.9);
        ctx.stroke();
      }
      const iceGrad = ctx.createRadialGradient(tx - r * 0.2, ty - r * 0.35, r * 0.1, tx, ty - r * 0.1, r * 0.9);
      iceGrad.addColorStop(0, "#eaf8ff");
      iceGrad.addColorStop(1, "#a8dcf2");
      ctx.fillStyle = iceGrad;
      ctx.strokeStyle = "#6ab0d8";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(tx, ty - r * 0.85);
      for (let i = 1; i <= 6; i++) {
        const a = (Math.PI * i) / 3 - Math.PI / 2;
        ctx.lineTo(tx + Math.cos(a) * r * 0.62, ty - r * 0.1 + Math.sin(a) * r * 0.75);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      drawFace(tx, ty + r * 0.05, r * 0.5);
    } else if (kind === "mist") {
      // 毒雾塔:胖蘑菇喷雾壶
      ctx.fillStyle = `rgba(181,216,168,${0.35 + anim * 0.3})`;
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * 2 * i) / 3 + anim * 2;
        ctx.beginPath();
        ctx.arc(tx + Math.cos(a) * r * (0.7 + anim * 0.4), ty - r * 0.6 + Math.sin(a) * r * 0.3, r * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
      const potGrad2 = ctx.createLinearGradient(tx, ty - r * 0.2, tx, ty + r * 0.8);
      potGrad2.addColorStop(0, "#cfe8c0");
      potGrad2.addColorStop(1, "#96c888");
      ctx.fillStyle = potGrad2;
      ctx.strokeStyle = "#6aa85e";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(tx, ty + r * 0.25, r * 0.6, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 蘑菇帽
      ctx.fillStyle = "#a884d8";
      ctx.strokeStyle = "#8a68b8";
      ctx.beginPath();
      ctx.arc(tx, ty - r * 0.25, r * 0.62, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(tx - r * 0.28, ty - r * 0.45, r * 0.12, 0, Math.PI * 2);
      ctx.arc(tx + r * 0.2, ty - r * 0.55, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      drawFace(tx, ty + r * 0.3, r * 0.45);
    } else {
      // 花火果:圆滚滚的小果子炮
      const potGrad = ctx.createLinearGradient(tx, ty - r * 0.2, tx, ty + r * 0.75);
      potGrad.addColorStop(0, "#ffd0ae");
      potGrad.addColorStop(1, "#f2a878");
      ctx.fillStyle = potGrad;
      ctx.strokeStyle = "#d88a58";
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(tx, ty + r * 0.25, r * 0.62, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e8926a";
      ctx.strokeStyle = "#c8744e";
      ctx.beginPath();
      ctx.ellipse(tx + r * 0.1, ty - r * 0.4, r * 0.3, r * 0.5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 引信小火花
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.arc(tx + r * (0.35 + anim * 0.3), ty - r * (0.75 + anim * 0.3), r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff9a4e";
      ctx.beginPath();
      ctx.arc(tx + r * (0.35 + anim * 0.3), ty - r * (0.75 + anim * 0.3), r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      drawFace(tx, ty + r * 0.25, r * 0.5);
    }
    // 等级:头顶小星星
    for (let i = 1; i < level; i++) {
      const sx = tx - r * 0.5 + (i - 1) * r * 0.45;
      const sy = ty - r * 1.2;
      ctx.fillStyle = "#ffc94e";
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (Math.PI * 2 * k) / 5 - Math.PI / 2;
        const outX = sx + Math.cos(a) * r * 0.16;
        const outY = sy + Math.sin(a) * r * 0.16;
        const a2 = a + Math.PI / 5;
        const inX = sx + Math.cos(a2) * r * 0.07;
        const inY = sy + Math.sin(a2) * r * 0.07;
        if (k === 0) ctx.moveTo(outX, outY);
        else ctx.lineTo(outX, outY);
        ctx.lineTo(inX, inY);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  const MONSTER_COLORS: Record<MonsterKind, string> = {
    softy: "#c9b6f2",
    fasty: "#9fd8f5",
    tanky: "#ffc09b",
    dashy: "#ffd868",
    shieldy: "#b8c8d8",
    splity: "#b5e8a8",
    sneaky: "#d8c8f0",
    healy: "#f5d8e8",
    mini: "#d5c9f5",
    boss1: "#ff9eb5",
    boss2: "#f0a878",
    boss3: "#c9a86a",
    boss4: "#e8c060",
    boss5: "#8aa86a",
    boss6: "#a8c8f0",
    boss7: "#e87a5a",
    boss8: "#9a8ac9",
    boss9: "#f078b0",
    flappy: "#a8d8e8",
    glidey: "#e8e2f5",
    boss10: "#8a9ae0",
    boss11: "#c9985a",
    boss12: "#9ec8ea",
    boss13: "#b06ad8",
    bossArmor: "#8fa8bc",
    bossSwift: "#7ec8e0",
    bossFly: "#c8dcf5",
    bossSplit: "#e8909a",
  };

  function drawMonster(m: Monster): void {
    const mx = px(m.x);
    const spec = MONSTER_INFO[m.kind];
    const r = cell * spec.size;
    // 飞怪浮在半空:身体抬高,影子留在地面且更小
    const lift = m.flying ? r * 0.85 + Math.sin(m.wob * 1.4) * r * 0.12 : 0;
    const my = py(m.y) - lift;
    const sq = 1 + Math.sin(m.wob) * 0.08;
    ctx.save();
    if (m.hidden) ctx.globalAlpha = 0.22;
    // 脚下软阴影
    ctx.fillStyle = m.flying ? "rgba(58,58,74,0.1)" : "rgba(58,58,74,0.14)";
    ctx.beginPath();
    ctx.ellipse(mx, py(m.y) + r * 1.02, r * (m.flying ? 0.55 : 0.9), r * (m.flying ? 0.16 : 0.26), 0, 0, Math.PI * 2);
    ctx.fill();
    const bodyColor = m.enraged ? "#7aa8e8" : MONSTER_COLORS[m.kind];
    const bodyGrad = ctx.createRadialGradient(mx - r * 0.35, my - r * 0.4, r * 0.15, mx, my, r * 1.25);
    bodyGrad.addColorStop(0, shade(bodyColor, 26));
    bodyGrad.addColorStop(1, bodyColor);
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = shade(bodyColor, -46);
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.beginPath();
    ctx.ellipse(mx, my, r * sq, r / sq, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (m.kind === "fasty" || m.kind === "sneaky" || m.flying) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      const flap = Math.sin(m.wob * (m.flying ? 3 : 2)) * r * (m.flying ? 0.42 : 0.3);
      const wingW = m.flying ? r * 0.6 : r * 0.45;
      ctx.beginPath();
      ctx.ellipse(mx - r * 0.9, my - r * 0.3 - flap, wingW, r * 0.22, -0.5, 0, Math.PI * 2);
      ctx.ellipse(mx + r * 0.9, my - r * 0.3 + flap, wingW, r * 0.22, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (m.kind === "tanky") {
      ctx.fillStyle = "#e8a878";
      ctx.beginPath();
      ctx.arc(mx, my - r * 0.55, r * 0.6, Math.PI, 0);
      ctx.fill();
    }
    if (m.kind === "dashy" && m.dashing) {
      ctx.strokeStyle = "rgba(255,216,104,0.8)";
      ctx.lineWidth = 3;
      for (let k = 1; k <= 2; k++) {
        ctx.beginPath();
        ctx.arc(mx - k * r * 0.9, my, r * 0.7, -0.6, 0.6);
        ctx.stroke();
      }
    }
    if (m.maxArmor > 0 && m.armor > 0) {
      ctx.fillStyle = "rgba(150,170,190,0.9)";
      ctx.beginPath();
      ctx.arc(mx, my - r * 0.2, r * 1.05, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "#7a90a8";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (m.kind === "healy") {
      ctx.fillStyle = "#e05a7a";
      ctx.font = `${Math.round(r * 0.8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💗", mx, my - r * 1.1);
    }
    if (m.kind === "splity") {
      // 两个小圆点表示会分身
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(mx - r * 0.4, my - r * 0.75, r * 0.2, 0, Math.PI * 2);
      ctx.arc(mx + r * 0.4, my - r * 0.75, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (spec.boss) {
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.moveTo(mx - r * 0.4, my - r * 0.95);
      ctx.lineTo(mx - r * 0.2, my - r * 1.35);
      ctx.lineTo(mx, my - r * 1.0);
      ctx.lineTo(mx + r * 0.2, my - r * 1.35);
      ctx.lineTo(mx + r * 0.4, my - r * 0.95);
      ctx.closePath();
      ctx.fill();
      if (m.kind === "boss2") {
        // 蟹蟹钳子
        ctx.strokeStyle = "#d0885a";
        ctx.lineWidth = Math.max(2, r * 0.14);
        ctx.beginPath();
        ctx.arc(mx - r * 1.15, my - r * 0.1, r * 0.3, 0.4, Math.PI * 1.6);
        ctx.arc(mx + r * 1.15, my - r * 0.1, r * 0.3, Math.PI * 1.4, Math.PI * 0.6);
        ctx.stroke();
      }
    }
    if (m.slowed) {
      ctx.fillStyle = "rgba(160,220,255,0.5)";
      ctx.beginPath();
      ctx.arc(mx + r * 0.7, my - r * 0.8, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(58,58,74,0.35)";
    ctx.beginPath();
    ctx.arc(mx - r * 0.4, my + r * 0.9, r * 0.16, 0, Math.PI * 2);
    ctx.arc(mx + r * 0.4, my + r * 0.9, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    drawFace(mx, my, r);
    // 血条(带护甲段)
    const bw = r * 2.2;
    const bh = Math.max(3, r * 0.16);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.roundRect(mx - bw / 2, my - r * 1.55, bw, bh, 3);
    ctx.fill();
    ctx.fillStyle = spec.boss ? "#e05a7a" : "#7ac97a";
    ctx.beginPath();
    ctx.roundRect(mx - bw / 2, my - r * 1.55, (bw * m.hp) / m.maxHp, bh, 3);
    ctx.fill();
    if (m.maxArmor > 0) {
      ctx.fillStyle = "#8aa0b8";
      ctx.beginPath();
      ctx.roundRect(mx - bw / 2, my - r * 1.55 - bh - 1, (bw * m.armor) / m.maxArmor, bh * 0.8, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function panelBox(pw: number, ph: number): { x: number; y: number } {
    const x = (w - pw) / 2;
    const y = h / 2 - ph / 2;
    ctx.fillStyle = "rgba(255,245,250,0.85)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 22);
    ctx.fill();
    return { x, y };
  }

  function drawButton(r: Rect, label: string, bg: string, fg: string): void {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  }

  function drawThemes(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#e3f7dc");
    grad.addColorStop(0.5, "#fdf3e0");
    grad.addColorStop(1, "#e8f0fb");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 无尽入口固定在右上角,标题在窄屏收短给它让位
    btnEndless = { x: w - 104, y: 8, w: 96, h: 34 };
    ctx.fillStyle = "#e05a7a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      w < 480 ? "🌼 花园守卫" : "🌼 花园守卫 · 十三章主题战役",
      10,
      25,
      w - 124,
    );
    ctx.textAlign = "center";
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#8a7a5e";
    ctx.fillText(
      `共 ${LEVELS.length} 关 · ⭐ ${totalStars(progress)}/${LEVELS.length * 3} · 先选主题,再选关卡`,
      w / 2,
      54,
      w - 20,
    );
    drawButton(btnEndless, "🛡️ 守到底", "#ffd868", "#7a5a1a");
    if (endlessBest > 0) {
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#8a7a5e";
      ctx.textAlign = "right";
      ctx.fillText(`最好第 ${endlessBest} 波`, w - 8, 48);
      ctx.textAlign = "center";
    }

    themeCards.length = 0;
    const cols = w > h * 1.15 ? 3 : 2;
    const rows = Math.ceil(THEME_ORDER.length / cols);
    const pad = 10;
    const x0 = Math.max(10, w * 0.06);
    const y0 = 72;
    const cw = (w - x0 * 2 - pad * (cols - 1)) / cols;
    const ch = Math.min(96, (h - y0 - 16 - pad * (rows - 1)) / rows);
    for (let i = 0; i < THEME_ORDER.length; i++) {
      const st = THEME_STYLE[THEME_ORDER[i]];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rect: Rect = { x: x0 + col * (cw + pad), y: y0 + row * (ch + pad), w: cw, h: ch };
      themeCards.push({ idx: i, rect });
      const unlocked = isThemeUnlocked(progress, i);
      const cleared = themeCleared(progress, i);
      ctx.fillStyle = unlocked ? st.bgA : "#e8e8ee";
      ctx.strokeStyle = unlocked ? st.accent : "#b8b8c2";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.round(ch * 0.32)}px sans-serif`;
      ctx.fillText(unlocked ? st.emoji : "🔒", rect.x + 10, rect.y + ch * 0.3);
      ctx.fillStyle = unlocked ? st.accent : "#9a9aa8";
      ctx.font = `bold ${Math.min(17, Math.round(ch * 0.22))}px sans-serif`;
      ctx.fillText(`第${i + 1}章 ${st.name}`, rect.x + 10 + ch * 0.42, rect.y + ch * 0.3);
      ctx.font = `${Math.min(12, Math.round(ch * 0.16))}px sans-serif`;
      ctx.fillStyle = unlocked ? "#5a5a6e" : "#a8a8b4";
      ctx.fillText(unlocked ? st.blurb : "通关上一章解锁", rect.x + 10, rect.y + ch * 0.6);
      ctx.fillText(
        unlocked
          ? `${cleared}/${themeSize(i)} 关 · ⭐${themeStars(progress, i)}/${themeSize(i) * 3}`
          : "",
        rect.x + 10,
        rect.y + ch * 0.82,
      );
    }
  }

  function drawMap(): void {
    const st = THEME_STYLE[THEME_ORDER[chapterIdx]];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, st.bgA);
    grad.addColorStop(1, st.bgB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    btnBack = { x: 6, y: 7, w: 62, h: 30 };
    drawButton(btnBack, "◀ 主题", "rgba(255,255,255,0.85)", "#5a5a6e");

    ctx.fillStyle = st.accent;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${st.emoji} 第${chapterIdx + 1}章 · ${st.name}`, w / 2, 28);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#6a6a7e";
    ctx.fillText(
      `⭐ ${themeStars(progress, chapterIdx)}/${themeSize(chapterIdx) * 3} · 通关解锁下一关,回放可刷 3 星`,
      w / 2,
      54,
    );

    mapNodes.length = 0;
    const base = themeOffset(chapterIdx);
    const count = themeSize(chapterIdx);
    // 新章节 22/23 关:窄屏 4 列,宽屏 5~6 列,保证节点不挤
    const cols = count <= 11 ? 4 : w > h * 1.1 ? 6 : 4;
    const rows = Math.ceil(count / cols);
    const mx0 = w * 0.12;
    const mx1 = w * 0.88;
    const my0 = 96;
    const my1 = h - 40;
    const nr = Math.max(12, Math.min(28, (mx1 - mx0) / cols / 2.4, (my1 - my0) / rows / 2.6));
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const colRaw = i % cols;
      const col = row % 2 === 0 ? colRaw : cols - 1 - colRaw;
      const x = mx0 + ((mx1 - mx0) * col) / (cols - 1);
      const y = my0 + (rows === 1 ? 0 : ((my1 - my0) * row) / (rows - 1));
      mapNodes.push({ idx: base + i, x, y, r: nr });
    }
    // 连线
    ctx.strokeStyle = "rgba(120,110,90,0.4)";
    ctx.lineWidth = 5;
    ctx.setLineDash([2, 9]);
    ctx.beginPath();
    for (let i = 0; i < mapNodes.length; i++) {
      const n = mapNodes[i];
      if (i === 0) ctx.moveTo(n.x, n.y);
      else ctx.lineTo(n.x, n.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // 节点
    for (const n of mapNodes) {
      const def = LEVELS[n.idx];
      const unlocked = isLevelUnlocked(progress, n.idx);
      const got = progress[n.idx] ?? 0;
      const isBoss = def.feature.includes("BOSS");
      const r = isBoss ? n.r * 1.25 : n.r;
      ctx.fillStyle = unlocked ? (got > 0 ? "#ffffff" : "#fffef5") : "rgba(230,230,236,0.9)";
      ctx.strokeStyle = unlocked ? st.accent : "#b8b8c2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!unlocked) {
        ctx.font = `${Math.round(r * 0.9)}px sans-serif`;
        ctx.fillText("🔒", n.x, n.y);
      } else {
        ctx.fillStyle = st.accent;
        ctx.font = `bold ${Math.round(r * 0.8)}px sans-serif`;
        ctx.fillText(String(n.idx - base + 1), n.x, n.y - (isBoss ? r * 0.1 : 0));
        if (isBoss) {
          ctx.font = `${Math.round(r * 0.6)}px sans-serif`;
          ctx.fillText("👑", n.x, n.y - r * 0.95);
        } else if (def.gen) {
          ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
          ctx.fillText("⚔", n.x, n.y - r * 1.05);
        }
        // 星星
        ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
        let starTxt = "";
        for (let s = 0; s < 3; s++) starTxt += s < got ? "⭐" : "▫";
        ctx.fillText(starTxt, n.x, n.y + r * 1.45);
      }
    }
  }

  function drawLevelSummaryPanel(): void {
    const def = curDef();
    const { y } = panelBox(Math.min(440, w - 40), 230);
    ctx.fillStyle = "#4a9a5a";
    ctx.font = "bold 25px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${chapterIdx + 1}-${levelIdx - themeOffset(chapterIdx) + 1} · ${def.name} 通过!`, w / 2, y + 42);
    ctx.font = "34px sans-serif";
    let starTxt = "";
    for (let s = 0; s < 3; s++) starTxt += s < earnedStars ? "⭐" : "☆";
    ctx.fillText(starTxt, w / 2, y + 90);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(
      earnedStars === 3 ? "一颗心都没掉,完美守卫!" : `掉了 ${heartsLost} 颗心 · 得分 ${score}`,
      w / 2,
      y + 126,
    );
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 158, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    if (levelIdx < LEVELS.length - 1) {
      btnNext = { x: w / 2 + 10, y: y + 158, w: bw2, h: 44 };
      drawButton(btnNext, "下一关 ▶", "#ffd868", "#7a5a1a");
    } else {
      btnNext = null;
    }
  }

  /** 本关有 BOSS 时,失败面板给一句针对性的短提示。 */
  function bossFailHint(): string | null {
    const def = curDef();
    for (const wave of def.waves) {
      for (const e of wave) {
        const spec = MONSTER_INFO[e.kind];
        if (!spec.boss) continue;
        if (spec.heals) return `${spec.name}会给随从回血,先集火它本体!`;
        if (spec.sneaks) return `${spec.name}会隐身,现身那几秒赶紧集火!`;
        if (spec.summons) return `${spec.name}会叫小兵,花火塔一炸一片!`;
        if (spec.splits) return `${spec.name}倒下会裂开,留塔看住路口!`;
        if (spec.dashes) return `${spec.name}会冲刺,露珠塔能拖住它!`;
        if (spec.enrages) return `${spec.name}半血会暴走,提前升级好塔!`;
        return `${spec.name}皮很厚,提前把塔升一升级!`;
      }
    }
    return null;
  }

  /** 无尽结束的面板：报成绩、报纪录，只鼓励 */
  function drawEndlessOverPanel(): void {
    const reached = Math.max(0, (endless?.wave ?? 1) - 1);
    const { y } = panelBox(Math.min(440, w - 40), 240);
    ctx.fillStyle = "#8a5ac9";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`守到了第 ${reached} 波!`, w / 2, y + 46);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(endlessLine(reached, endlessBest), w / 2, y + 90, Math.min(400, w - 60));
    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = "#a05914";
    ctx.fillText(`🏅 最好成绩:第 ${endlessBest} 波`, w / 2, y + 126);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 168, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: y + 168, w: bw2, h: 44 };
    drawButton(btnMap, "回主题", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再守一次", "#ffd868", "#7a5a1a");
  }

  function drawRetryPanel(): void {
    if (endless) {
      drawEndlessOverPanel();
      return;
    }
    const hint = bossFailHint();
    const { y } = panelBox(Math.min(440, w - 40), hint ? 240 : 210);
    // 深紫替代浅紫:白底大字对比 4.8:1(原 #b28ae8 只有 2.7:1,不达 AA)
    ctx.fillStyle = "#8a5ac9";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("哎呀,花朵蔫了……", w / 2, y + 46);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText("没关系!就在这一关再来一次", w / 2, y + 84);
    let by = y + 130;
    if (hint) {
      // BOSS 失败给一句针对性提示,温柔不吓人(深橙 5.3:1,14px 小字要 4.5:1)
      ctx.fillStyle = "#a05914";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`💡 ${hint}`, w / 2, y + 116, Math.min(400, w - 60));
      by = y + 160;
    }
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: by, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: by, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再试一次", "#ffd868", "#7a5a1a");
  }

  function drawIntroPanel(): void {
    const def = curDef();
    const st = THEME_STYLE[def.theme];
    const { y } = panelBox(Math.min(450, w - 40), 200);
    ctx.fillStyle = st.accent;
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      endless
        ? `🛡️ 无尽守到底 · 最好第 ${endlessBest} 波`
        : `${chapterIdx + 1}-${levelIdx - themeOffset(chapterIdx) + 1} · ${def.name}`,
      w / 2,
      y + 44,
    );
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "16px sans-serif";
    ctx.fillText(def.hint, w / 2, y + 90, Math.min(420, w - 60));
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    const wSpec = def.weather && def.weather !== "clear" ? WEATHER_INFO[def.weather] : null;
    ctx.fillText(
      endless
        ? `${st.name} · 一波接一波,守住就还有下一波 · 点一下屏幕开始`
        : `${st.name} · ${def.waves.length} 波${wSpec ? ` · ${wSpec.emoji}${wSpec.name}` : ""} · 点一下屏幕开始`,
      w / 2,
      y + 130,
      Math.min(420, w - 60),
    );
    ctx.fillText(endless ? "(左上角 ◀ 可回主题)" : "(左上角 ◀ 可回地图)", w / 2, y + 158);
  }

  /**
   * 下一波预览:提前把「来什么、来几只、该防什么」摆在孩子面前。
   *
   * 这块是本款 1.2 最重要的一处改动——1.1 只写「第 N 波要来啦」，
   * 孩子只能等怪出来再手忙脚乱地补塔；有了预览才谈得上「准备」。
   * 顺手挂一个「提前召唤」按钮：布好了就早点叫，早几秒换几片花瓣。
   */
  function drawWavePreview(): void {
    const def = curDef();
    const wave = def.waves[Math.min(waveIdx, def.waves.length - 1)] ?? [];
    const items = wavePreview(wave);
    // 只画前三种:再多在 360 宽就要挤成一团,剩下的用「+n 种」带过
    const shown = items.slice(0, 3);
    const stripY = HUD_H + TOOLBAR_H + 4;
    const stripH = 34;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.beginPath();
    ctx.roundRect(8, stripY, w - 16, stripH, 17);
    ctx.fill();

    const cy = stripY + stripH / 2;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#e05a7a";
    ctx.font = "bold 13px sans-serif";
    const waveNo = endless ? endless.wave : waveIdx + 1;
    ctx.fillText(`第${waveNo}波 ${Math.max(0, phaseTimer).toFixed(1)}s`, 18, cy);

    const bonus = earlyCallBonus(phaseTimer);
    const callW = 78;
    btnCallNow = { x: w - 14 - callW, y: stripY + 3, w: callW, h: stripH - 6 };

    // 图标 + 数量:一只一只画,BOSS 加一圈金边
    let ix = 96;
    const iconRight = btnCallNow.x - 8;
    for (const it of shown) {
      if (ix + 40 > iconRight) break;
      ctx.fillStyle = MONSTER_COLORS[it.kind];
      ctx.beginPath();
      ctx.arc(ix + 9, cy, it.boss ? 11 : 8, 0, Math.PI * 2);
      ctx.fill();
      if (it.boss) {
        ctx.strokeStyle = "#e0a030";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`×${it.count}`, ix + 21, cy);
      ix += 21 + ctx.measureText(`×${it.count}`).width + 12;
    }
    if (items.length > shown.length && ix + 40 <= iconRight) {
      ctx.fillStyle = "#8a8a9a";
      ctx.font = "12px sans-serif";
      ctx.fillText(`+${items.length - shown.length}种`, ix, cy);
    }

    ctx.textAlign = "center";
    drawButton(btnCallNow, bonus > 0 ? `召唤+${bonus}🌸` : "召唤", "#ffd868", "#7a5a1a");

    // 「该防什么」只在栅格上方还有空地时才画,免得盖住要放塔的第一排格子
    const slack = oy - (stripY + stripH);
    if (slack >= 26) {
      const tip = previewAdvice(items);
      ctx.font = "13px sans-serif";
      const tw = Math.min(w - 24, ctx.measureText(tip).width + 22);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.roundRect((w - tw) / 2, stripY + stripH + 3, tw, 22, 11);
      ctx.fill();
      ctx.fillStyle = "#5a5a6e";
      ctx.textAlign = "center";
      ctx.fillText(tip, w / 2, stripY + stripH + 14, tw - 14);
    }
  }

  function draw(): void {
    if (phase === "themes") {
      drawThemes();
      return;
    }
    if (phase === "map") {
      drawMap();
      return;
    }

    const def = curDef();
    const st = THEME_STYLE[def.theme];
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
    }

    ctx.fillStyle = st.bgB;
    ctx.fillRect(-20, -20, w + 40, h + 40);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? st.bgA : st.bgB;
        ctx.fillRect(px(c), py(r), cell + 0.5, cell + 0.5);
      }
    }
    // 可种植的空格画成圆角"花园土坑",种在哪里一目了然
    const canAfford = petals >= TOWER_INFO[selectedCard].cost;
    const hintPulse = 0.22 + Math.sin(time * 4) * 0.1;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const key = `${c},${r}`;
        if (blocked.has(key)) continue;
        const inset = cell * 0.1;
        ctx.fillStyle = "rgba(150,110,70,0.13)";
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath();
        ctx.roundRect(px(c) + inset, py(r) + inset, cell - inset * 2, cell - inset * 2, cell * 0.2);
        ctx.fill();
        ctx.stroke();
        if (!occupied.has(key) && !barricades.has(key) && (phase === "wave" || phase === "prewave") && canAfford) {
          // 呼吸的绿色"+":告诉小朋友这里能种
          ctx.strokeStyle = `rgba(90,168,120,${hintPulse})`;
          ctx.lineWidth = Math.max(2, cell * 0.06);
          ctx.lineCap = "round";
          const cxc = px(c + 0.5);
          const cyc = py(r + 0.5);
          const arm = cell * 0.12;
          ctx.beginPath();
          ctx.moveTo(cxc - arm, cyc);
          ctx.lineTo(cxc + arm, cyc);
          ctx.moveTo(cxc, cyc - arm);
          ctx.lineTo(cxc, cyc + arm);
          ctx.stroke();
        }
      }
    }
    // 怪物走的小路:圆润路面 + 小鹅卵石
    for (const key of blocked) {
      const [c, r] = key.split(",").map(Number);
      ctx.fillStyle = st.path;
      ctx.fillRect(px(c), py(r), cell + 0.5, cell + 0.5);
    }
    for (const key of blocked) {
      const [c, r] = key.split(",").map(Number);
      const seed = (c * 31 + r * 17) % 7;
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.ellipse(
        px(c) + cell * (0.25 + (seed % 3) * 0.22),
        py(r) + cell * (0.3 + ((seed * 5) % 4) * 0.14),
        cell * 0.07,
        cell * 0.05,
        seed,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // 起点小门与终点花朵(每条路)
    for (let pi = 0; pi < wpList.length; pi++) {
      const wp = wpList[pi];
      const start = wp[0];
      ctx.fillStyle = "#c9b6f2";
      ctx.beginPath();
      ctx.arc(px(start.x), py(start.y), cell * 0.32, Math.PI, 0);
      ctx.fill();
      const end = wp[wp.length - 1];
      const fx = px(end.x);
      const fy = py(end.y);
      const fr = cell * 0.34;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + time * 0.4;
        ctx.fillStyle = i < hearts ? "#ffb3c8" : "#e9d8dd";
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr, fr * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe387";
      ctx.beginPath();
      ctx.arc(fx, fy, fr * 0.8, 0, Math.PI * 2);
      ctx.fill();
      drawFace(fx, fy, fr * 0.8);
    }

    // 露珠塔光环 / 毒雾塔毒圈(射程受天气影响)
    for (const t of towers) {
      if (t.kind === "dew") {
        const rr = effectiveRange("dew", t.level, def.weather) * cell;
        ctx.fillStyle = `rgba(160,220,255,${0.12 + Math.sin(time * 3) * 0.04})`;
        ctx.beginPath();
        ctx.arc(px(t.col + 0.5), py(t.row + 0.5), rr, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.kind === "mist") {
        const rr = effectiveRange("mist", t.level, def.weather) * cell;
        ctx.fillStyle = `rgba(150,200,136,${0.1 + t.firedAnim * 0.12})`;
        ctx.beginPath();
        ctx.arc(px(t.col + 0.5), py(t.row + 0.5), rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (selectedTower) {
      const t = selectedTower;
      if (TOWER_INFO[t.kind].range > 0) {
        ctx.strokeStyle = "rgba(224,90,122,0.5)";
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px(t.col + 0.5), py(t.row + 0.5), effectiveRange(t.kind, t.level, def.weather) * cell, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 路障:木箱占着塔位,点一点敲碎
    for (const [key, bhp] of barricades) {
      const [c, r] = key.split(",").map(Number);
      const bx = px(c + 0.5);
      const byc = py(r + 0.5);
      const s = cell * 0.33;
      ctx.fillStyle = "#c9a86a";
      ctx.strokeStyle = "#9a7a44";
      ctx.lineWidth = Math.max(1.5, cell * 0.035);
      ctx.beginPath();
      ctx.roundRect(bx - s, byc - s, s * 2, s * 2, cell * 0.08);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx - s, byc - s);
      ctx.lineTo(bx + s, byc + s);
      ctx.moveTo(bx + s, byc - s);
      ctx.lineTo(bx - s, byc + s);
      ctx.stroke();
      // 耐久小点
      ctx.fillStyle = "#7a5a34";
      for (let i = 0; i < bhp; i++) {
        ctx.beginPath();
        ctx.arc(bx - s + cell * 0.09 + i * cell * 0.13, byc + s - cell * 0.1, cell * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const t of towers) {
      drawTowerBase(px(t.col + 0.5), py(t.row + 0.5), cell * 0.3);
      drawTowerIcon(t.kind, px(t.col + 0.5), py(t.row + 0.5), cell * 0.3, t.level, t.firedAnim);
    }

    for (const m of monsters) drawMonster(m);

    for (const b of bullets) {
      const bx = px(b.x);
      const by = py(b.y);
      if (b.needle) {
        const tgt = b.target;
        const a = tgt ? Math.atan2(tgt.y - b.y, tgt.x - b.x) : 0;
        ctx.strokeStyle = "#5aa878";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(a) * cell * 0.14, by - Math.sin(a) * cell * 0.14);
        ctx.lineTo(bx + Math.cos(a) * cell * 0.14, by + Math.sin(a) * cell * 0.14);
        ctx.stroke();
      } else if (b.splash > 0) {
        ctx.fillStyle = "#e8926a";
        ctx.beginPath();
        ctx.arc(bx, by, cell * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffd868";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, cell * 0.2, time * 8, time * 8 + Math.PI);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(160,220,255,0.85)";
        ctx.beginPath();
        ctx.arc(bx, by, cell * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(bx - cell * 0.03, by - cell * 0.04, cell * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 塔操作面板
    panelUpgrade = null;
    panelSell = null;
    if (selectedTower && (phase === "wave" || phase === "prewave")) {
      const t = selectedTower;
      const cxp = px(t.col + 0.5);
      const topY = py(t.row) - 46;
      const bw2 = 92;
      const gap = 6;
      const x0 = Math.max(6, Math.min(w - bw2 * 2 - gap - 6, cxp - bw2 - gap / 2));
      const yy = Math.max(HUD_H + TOOLBAR_H + 4, topY);
      panelUpgrade = { x: x0, y: yy, w: bw2, h: 36 };
      panelSell = { x: x0 + bw2 + gap, y: yy, w: bw2, h: 36 };
      const canUp = t.level < MAX_TOWER_LEVEL;
      ctx.fillStyle = canUp ? "#fff1c9" : "#eeeef2";
      ctx.strokeStyle = canUp ? "#ffb84d" : "#c8c8d2";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(panelUpgrade.x, panelUpgrade.y, panelUpgrade.w, panelUpgrade.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = canUp ? "#c47a2a" : "#9a9aa8";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        canUp ? `⬆升级 ${upgradeCost(t.kind, t.level)}🌸` : "已满级",
        panelUpgrade.x + bw2 / 2,
        panelUpgrade.y + 18,
      );
      ctx.fillStyle = "#ffe3ec";
      ctx.strokeStyle = "#ff9eb5";
      ctx.beginPath();
      ctx.roundRect(panelSell.x, panelSell.y, panelSell.w, panelSell.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e05a7a";
      ctx.fillText(`卖 +${sellRefund(t.kind, t.level)}🌸`, panelSell.x + bw2 / 2, panelSell.y + 18);
    }

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 22px sans-serif" : "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ---- HUD ----
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(0, 0, w, HUD_H);
    btnBack = { x: 6, y: 7, w: 62, h: 30 };
    drawButton(btnBack, "◀ 地图", "#f0f0f5", "#5a5a6e");
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "17px sans-serif";
    ctx.fillStyle = petalFlash > 0 && Math.floor(petalFlash * 8) % 2 === 0 ? "#e05a7a" : "#5a5a6e";
    ctx.fillText(`🌸 ${petals}`, 78, HUD_H / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "15px sans-serif";
    // 窄屏修复:360 宽中间只显示"章-关 · 波n/m",右侧只留爱心,
    // 原"(99/99)+分数"三段长文字会和左边花瓣数、右边爱心互相压盖
    const narrowHud = w < 480;
    const levelInTheme = levelIdx - themeOffset(chapterIdx) + 1;
    const hudWeather = def.weather && def.weather !== "clear" ? ` ${WEATHER_INFO[def.weather].emoji}` : "";
    // 倍速按钮吃掉右上角一小块,爱心和分数往左让
    btnSpeed = { x: w - 52, y: 6, w: 46, h: 32 };
    const hudRight = w - 60;
    ctx.fillText(
      endless
        ? `🛡️ 守到底 · 第 ${endless.wave} 波`
        : narrowHud
          ? `${chapterIdx + 1}-${levelInTheme}${hudWeather} · 波${waveIdx + 1}/${def.waves.length}`
          : `${chapterIdx + 1}-${levelInTheme} (${levelIdx + 1}/${LEVELS.length})${hudWeather} · 波 ${waveIdx + 1}/${def.waves.length}`,
      w / 2,
      HUD_H / 2,
      w - 220,
    );
    ctx.textAlign = "right";
    ctx.fillText(
      // 窄屏爱心收成「💗×n」,不然 5 颗爱心 + 倍速按钮会挤出屏幕
      (narrowHud
        ? `💗×${Math.max(0, hearts)}`
        : "💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, HEARTS_PER_LEVEL - hearts))) +
        (narrowHud ? "" : `  分 ${score}`),
      hudRight,
      HUD_H / 2,
    );
    drawButton(btnSpeed, speed >= 2 ? "2×" : "1×", speed >= 2 ? "#ffd868" : "#f0f0f5", speed >= 2 ? "#7a5a1a" : "#5a5a6e");

    if (combo >= 2 && comboTimer > 0) {
      ctx.fillStyle = "#b28ae8";
      ctx.font = `bold ${20 + Math.min(combo, 8)}px sans-serif`;
      ctx.textAlign = "center";
      // 连击字样往下挪,避开工具栏下方的选中提示条
      ctx.fillText(`连击 ×${combo}`, w / 2, HUD_H + TOOLBAR_H + 52);
    }

    // ---- 工具栏(只显示已解锁的塔) ----
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(0, HUD_H, w, TOOLBAR_H);
    cardRects.length = 0;
    // 窄屏修复:卡片改为"图标在上 + 价格在下",价格 12→14px 加粗;
    // 塔名和说明挪到工具栏下方的选中提示条里,360 宽放 5 张卡也不挤
    const cw = Math.min(96, (w - 24) / unlockedTowers.length);
    for (let i = 0; i < unlockedTowers.length; i++) {
      const kind = unlockedTowers[i];
      const rect: Rect = { x: 8 + i * (cw + 6), y: HUD_H + 6, w: cw, h: TOOLBAR_H - 12 };
      cardRects.push({ kind, rect });
      const afford = petals >= TOWER_INFO[kind].cost;
      ctx.fillStyle = selectedCard === kind ? "#fff1c9" : afford ? "#f6f6fa" : "#efeff3";
      ctx.strokeStyle = selectedCard === kind ? "#ffb84d" : "rgba(0,0,0,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = afford ? 1 : 0.45;
      drawTowerIcon(kind, rect.x + rect.w / 2, rect.y + 13, 10);
      ctx.fillStyle = afford ? "#5a5a6e" : "#8a8a9a";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${TOWER_INFO[kind].cost}🌸`, rect.x + rect.w / 2, rect.y + rect.h - 11);
      ctx.globalAlpha = 1;
    }
    // 两段式放塔提示:选中卡片后,工具栏下方一条 14px 说明,再点草地格就能种
    // (布阵倒计时里这条让位给下一波预览,两者共用同一行)
    if (selectedCard && phase !== "prewave") {
      const info = TOWER_INFO[selectedCard];
      const tip = `${info.name} ${info.cost}🌸 · ${info.desc} · 点草地放置`;
      ctx.font = "14px sans-serif";
      const tipW = Math.min(w - 16, ctx.measureText(tip).width + 24);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.roundRect((w - tipW) / 2, HUD_H + TOOLBAR_H + 4, tipW, 26, 13);
      ctx.fill();
      ctx.fillStyle = "#5a5a6e";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tip, w / 2, HUD_H + TOOLBAR_H + 17, tipW - 16);
    }

    // ---- 覆盖层 ----
    if (phase === "intro") {
      drawIntroPanel();
      // 覆盖层上补画返回按钮,保证可点
      drawButton(btnBack, "◀ 地图", "#f0f0f5", "#5a5a6e");
    } else if (phase === "clear") {
      drawLevelSummaryPanel();
    } else if (phase === "retry") {
      drawRetryPanel();
    } else if (phase === "prewave") {
      drawWavePreview();
    }
  }

  let raf = 0;
  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    syncSize();
    // 固定步长:2 倍速只是同样的子步多跑几个,所以 2× 和 1× 的结果完全一致
    const plan = planSteps(stepCarry, dt, speed);
    stepCarry = plan.rest;
    for (let i = 0; i < plan.steps; i++) update(FIXED_STEP);
    draw();
    raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  syncSize();
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      stopSpeaking();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.remove();
    },
  };
}
