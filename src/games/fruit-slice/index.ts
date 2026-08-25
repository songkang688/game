// 水果切切乐:99 回合九大果园经典战役 + 禅宗无炸弹限时 + 街机无尽!
// 先选果园再选回合;侧风、低重力、急坠、小果大瓜,每个果园手感都不一样!
import {
  BEST_KEY,
  BIG_BOMB_HEARTS,
  BOOM_RADIUS,
  BestScores,
  COMBO_WINDOW,
  FRENZY_MULTIPLIER,
  FRENZY_SECONDS,
  HEARTS_PER_ROUND,
  ICE_SECONDS,
  ICE_SLOW,
  LEVELS_PER_THEME,
  ORCHARD_ORDER,
  ORCHARD_STYLE,
  OrchardStyle,
  PROGRESS_KEY,
  ROUNDS,
  SPECIAL_CHANCE,
  SpecialKind,
  ZEN_SECONDS,
  arcadePace,
  arcadeStars,
  comboBonus,
  comboLabel,
  gravityFor,
  isLevelUnlocked,
  isThemeUnlocked,
  makeLaunch,
  parseBest,
  parseProgress,
  segCircleHit,
  serializeBest,
  serializeProgress,
  starsForRound,
  themeCleared,
  themeStars,
  totalStars,
  zenStars,
} from "./logic";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export interface GameAPI {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

export const meta = {
  id: "fruit-slice",
  title: "水果切切乐",
  emoji: "🍑",
  category: "action" as const,
  color: "#ffe0a3",
  blurb: "99 回合九大果园切果战役!侧风低重力手感各异,禅宗街机三种玩法!",
};

type Mode = "classic" | "zen" | "arcade";
type Phase = "menu" | "themes" | "map" | "intro" | "play" | "clear" | "retry" | "end";

interface FruitKind {
  name: string;
  skin: string;
  flesh: string;
  r: number;
}

const FRUITS: FruitKind[] = [
  { name: "桃桃", skin: "#ffb3c1", flesh: "#fff0f3", r: 30 },
  { name: "橙橙", skin: "#ffc46b", flesh: "#ffe8c2", r: 28 },
  { name: "瓜瓜", skin: "#8fd47a", flesh: "#ff8fa3", r: 36 },
  { name: "莓莓", skin: "#91a7ff", flesh: "#e0e7ff", r: 22 },
  { name: "柠柠", skin: "#ffe66b", flesh: "#fff9d6", r: 26 },
];

type FlyKind = "fruit" | "bomb" | "bigbomb" | "banana" | "ice" | "boom";

interface Flying {
  fly: FlyKind;
  kind: FruitKind | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  r: number;
}

interface Half {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  r: number;
  skin: string;
  flesh: string;
  life: number;
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

interface Splash {
  x: number;
  y: number;
  life: number;
  color: string;
}

interface Ring {
  x: number;
  y: number;
  life: number;
  maxR: number;
  color: string;
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
    return parseProgress(localStorage.getItem(PROGRESS_KEY), ROUNDS.length);
  } catch {
    return parseProgress(null, ROUNDS.length);
  }
}

function saveProgress(stars: number[]): void {
  try {
    localStorage.setItem(PROGRESS_KEY, serializeProgress(stars));
  } catch {
    // 静默失败
  }
}

function loadBest(): BestScores {
  try {
    return parseBest(localStorage.getItem(BEST_KEY));
  } catch {
    return parseBest(null);
  }
}

function saveBest(best: BestScores): void {
  try {
    localStorage.setItem(BEST_KEY, serializeBest(best));
  } catch {
    // 静默失败
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

  let w = 640;
  let h = 480;
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
  }
  syncSize();

  const progress = loadProgress();
  const best = loadBest();

  // ---- 局状态 ----
  let mode: Mode = "classic";
  let phase: Phase = "menu";
  let chapterIdx = 0;
  let roundIdx = 0;
  let roundScore = 0;
  let totalScore = 0;
  let roundTime = 0;
  let hearts = HEARTS_PER_ROUND;
  let heartsLost = 0;
  let bestCombo = 0;
  let earnedStars: 1 | 2 | 3 = 1;
  let endStars: 0 | 1 | 2 | 3 = 0;
  let finaleFired = false;
  let destroyed = false;

  const flying: Flying[] = [];
  const halves: Half[] = [];
  const trail: TrailPoint[] = [];
  const splashes: Splash[] = [];
  const rings: Ring[] = [];
  const floats: Floaty[] = [];

  let time = 0;
  let launchTimer = 0.8;
  let slicing = false;
  let lastX = 0;
  let lastY = 0;
  let shake = 0;
  let hitStop = 0;
  let frenzyTimer = 0;
  let frenzyLaunch = 0;
  let freezeTimer = 0;

  // 连击窗口
  let comboCount = 0;
  let comboClock = 0;
  let comboX = 0;
  let comboY = 0;

  const menuRects: Array<{ mode: Mode; rect: Rect }> = [];
  const themeCards: Array<{ idx: number; rect: Rect }> = [];
  const mapNodes: Array<{ idx: number; x: number; y: number; r: number }> = [];
  let btnNext: Rect | null = null;
  let btnMap: Rect | null = null;
  let btnRetry: Rect | null = null;
  let btnMenu: Rect | null = null;
  let btnBack: Rect = { x: 0, y: 0, w: 0, h: 0 };

  function round() {
    return ROUNDS[Math.min(roundIdx, ROUNDS.length - 1)];
  }

  const NEUTRAL_STYLE: OrchardStyle = ORCHARD_STYLE.sunny;

  /** 经典模式用当前回合所在果园的手感;禅宗/街机用阳光果园的中性手感。 */
  function orchardStyle(): OrchardStyle {
    return mode === "classic" ? ORCHARD_STYLE[round().orchard] : NEUTRAL_STYLE;
  }

  /** 星夜/火山是深色背景,文字要换成浅色。 */
  function isDarkOrchard(ci: number): boolean {
    const id = ORCHARD_ORDER[ci];
    return id === "night" || id === "volcano";
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.2 : 0.85, big });
  }

  function resetRound(): void {
    if (mode === "classic") chapterIdx = Math.floor(roundIdx / LEVELS_PER_THEME);
    flying.length = 0;
    halves.length = 0;
    splashes.length = 0;
    rings.length = 0;
    roundScore = 0;
    totalScore = mode === "classic" ? totalScore : 0;
    roundTime = mode === "classic" ? round().time : mode === "zen" ? ZEN_SECONDS : 0;
    hearts = HEARTS_PER_ROUND;
    heartsLost = 0;
    launchTimer = 0.8;
    frenzyTimer = 0;
    freezeTimer = 0;
    comboCount = 0;
    comboClock = 0;
  }

  function startMode(m: Mode): void {
    mode = m;
    roundIdx = 0;
    totalScore = 0;
    bestCombo = 0;
    time = 0;
    if (m === "classic") {
      phase = "themes";
    } else {
      resetRound();
      phase = "intro";
    }
  }

  function roundCleared(): void {
    settleCombo();
    earnedStars = starsForRound(heartsLost);
    const prev = progress[roundIdx] ?? 0;
    const gained = Math.max(0, earnedStars - prev);
    progress[roundIdx] = Math.max(prev, earnedStars);
    saveProgress(progress);
    phase = "clear";
    api.play("win");
    if (roundIdx >= ROUNDS.length - 1 && !finaleFired) {
      finaleFired = true;
      api.onWin(
        earnedStars,
        `99 回合九大果园全通关,你就是传说果神!最高 ${bestCombo} 连切 · 总星 ${totalStars(progress)}/${ROUNDS.length * 3}`,
      );
    } else if (gained > 0) {
      api.addStars(gained);
      addFloat(w / 2, h / 2 - 110, `+${gained} ⭐`, "#e0a030", true);
    }
  }

  function endFreeMode(): void {
    settleCombo();
    phase = "end";
    endStars = mode === "zen" ? zenStars(totalScore) : arcadeStars(totalScore);
    const prevBest = mode === "zen" ? best.zen : best.arcade;
    const prevStars = mode === "zen" ? zenStars(prevBest) : arcadeStars(prevBest);
    const gained = Math.max(0, endStars - prevStars);
    if (mode === "zen") best.zen = Math.max(best.zen, totalScore);
    else best.arcade = Math.max(best.arcade, totalScore);
    saveBest(best);
    if (gained > 0) {
      api.addStars(gained);
      addFloat(w / 2, h / 2 - 120, `+${gained} ⭐`, "#e0a030", true);
    }
    api.play(endStars > 0 ? "win" : "oops");
  }

  function roundFail(): void {
    settleCombo();
    if (mode === "classic") {
      phase = "retry";
      api.play("oops");
    } else {
      endFreeMode();
    }
  }

  // ---- 抛射 ----
  function radiusFor(fly: FlyKind): number {
    if (fly === "bigbomb") return 38;
    if (fly === "banana") return 30;
    return 26;
  }

  function launchOne(fly: FlyKind): void {
    const st = orchardStyle();
    const l = makeLaunch(w, h, Math.random(), Math.random(), Math.random());
    // 初速按重力倍率开方缩放:抛物线顶点不变,低重力飘、高重力砸。
    const vyScale = Math.sqrt(st.gravityMult);
    if (fly === "fruit") {
      const kind = FRUITS[Math.floor(Math.random() * FRUITS.length)];
      flying.push({
        fly,
        kind,
        x: l.x,
        y: l.y,
        vx: l.vx,
        vy: l.vy * vyScale,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 4,
        r: kind.r * st.fruitScale,
      });
    } else {
      flying.push({
        fly,
        kind: null,
        x: l.x,
        y: l.y,
        vx: l.vx,
        vy: l.vy * vyScale * (fly === "bigbomb" ? 0.92 : 1),
        rot: fly === "banana" ? Math.random() * Math.PI : 0,
        vrot: (Math.random() - 0.5) * (fly === "banana" ? 5 : 2),
        r: radiusFor(fly),
      });
    }
  }

  function activeSpecials(): SpecialKind[] {
    if (mode === "classic") return round().specials;
    return ["banana", "ice", "boom"];
  }

  function launchVolley(): void {
    const r = round();
    const min = mode === "classic" ? r.volleyMin : mode === "zen" ? 2 : 1;
    const max = mode === "classic" ? r.volleyMax : mode === "zen" ? 4 : 3;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    for (let i = 0; i < n; i++) launchOne("fruit");
    if (mode !== "zen" && time > 4) {
      const bombChance = mode === "arcade" ? arcadePace(totalScore).bombChance : r.bombChance;
      const bigChance = mode === "arcade" ? Math.min(0.1, totalScore / 1500) : r.bigBombChance;
      if (Math.random() < bigChance) launchOne("bigbomb");
      else if (Math.random() < bombChance) launchOne("bomb");
    }
    for (const sp of activeSpecials()) {
      if (Math.random() < SPECIAL_CHANCE) launchOne(sp);
    }
    api.play("jump");
  }

  // ---- 连击结算 ----
  function settleCombo(): void {
    if (comboCount >= 2) {
      const bonus = comboBonus(comboCount);
      roundScore += bonus;
      totalScore += bonus;
      bestCombo = Math.max(bestCombo, comboCount);
      const label = comboLabel(comboCount);
      if (label) addFloat(comboX, comboY - 30, `${label} +${bonus}`, "#b28ae8", true);
      api.play("coin");
      if (comboCount >= 3) {
        hitStop = 0.28;
        shake = Math.min(0.35, 0.1 + comboCount * 0.05);
      }
    }
    comboCount = 0;
    comboClock = 0;
  }

  function checkClassicTarget(): boolean {
    if (mode !== "classic") return false;
    if (roundScore < round().target) return false;
    roundCleared();
    return true;
  }

  function sliceFruit(f: Flying, x1: number, y1: number, x2: number, y2: number): void {
    const kind = f.kind as FruitKind;
    const mult = frenzyTimer > 0 ? FRENZY_MULTIPLIER : 1;
    const gain = 1 * mult;
    roundScore += gain;
    totalScore += gain;
    comboCount++;
    comboClock = COMBO_WINDOW;
    comboX = f.x;
    comboY = f.y;
    api.play("pop");
    addFloat(f.x, f.y - 10, `+${gain}`, "#c47a2a");
    splashes.push({ x: f.x, y: f.y, life: 0.5, color: kind.flesh });
    const angle = Math.atan2(y2 - y1, x2 - x1);
    for (const side of [-1, 1]) {
      halves.push({
        x: f.x,
        y: f.y,
        vx: f.vx + Math.cos(angle + (Math.PI / 2) * side) * 130,
        vy: f.vy * 0.3 + Math.sin(angle + (Math.PI / 2) * side) * 130 - 60,
        rot: angle,
        vrot: side * 3,
        r: f.r,
        skin: kind.skin,
        flesh: kind.flesh,
        life: 1.2,
      });
    }
  }

  function sliceBomb(f: Flying, big: boolean): void {
    const lost = big ? BIG_BOMB_HEARTS : 1;
    hearts -= lost;
    heartsLost += lost;
    shake = big ? 0.9 : 0.6;
    comboCount = 0;
    comboClock = 0;
    api.play("oops");
    splashes.push({ x: f.x, y: f.y, life: 0.8, color: "#8a93a8" });
    rings.push({ x: f.x, y: f.y, life: 0.6, maxR: big ? 220 : 110, color: big ? "#e05a7a" : "#8a93a8" });
    if (big) {
      // 大炸弹把全屏水果炸飞(不得分)
      for (let i = flying.length - 1; i >= 0; i--) {
        const other = flying[i];
        if (other === f || other.fly === "bomb" || other.fly === "bigbomb") continue;
        splashes.push({ x: other.x, y: other.y, life: 0.5, color: "#c8c8d2" });
        flying.splice(i, 1);
      }
      addFloat(f.x, f.y - 24, `轰!大炸弹 -${lost}💗`, "#e05a7a", true);
    } else {
      addFloat(f.x, f.y - 20, "哎呀,是小炸弹!", "#5c6b8a", true);
    }
    if (hearts <= 0) roundFail();
  }

  function sliceBanana(f: Flying): void {
    frenzyTimer = FRENZY_SECONDS;
    frenzyLaunch = 0;
    shake = 0.3;
    api.play("win");
    addFloat(w / 2, h * 0.3, "彩虹香蕉!水果雨来啦!!", "#e0a030", true);
    splashes.push({ x: f.x, y: f.y, life: 0.6, color: "#ffe66b" });
  }

  function sliceIce(f: Flying): void {
    freezeTimer = ICE_SECONDS;
    api.play("coin");
    addFloat(w / 2, h * 0.3, "冰冻果!全场慢动作~", "#5a8ac9", true);
    splashes.push({ x: f.x, y: f.y, life: 0.6, color: "#bfe9ff" });
    rings.push({ x: f.x, y: f.y, life: 0.7, maxR: 160, color: "#8fd0f0" });
  }

  function sliceBoom(f: Flying, x1: number, y1: number, x2: number, y2: number): void {
    api.play("coin");
    shake = 0.4;
    addFloat(f.x, f.y - 24, "爆裂果开花!", "#e07a3a", true);
    rings.push({ x: f.x, y: f.y, life: 0.6, maxR: BOOM_RADIUS, color: "#ffb84d" });
    // 范围内水果全部切开得分,炸弹被安全排掉
    for (let i = flying.length - 1; i >= 0; i--) {
      const other = flying[i];
      if (other === f) continue;
      if (Math.hypot(other.x - f.x, other.y - f.y) > BOOM_RADIUS) continue;
      flying.splice(i, 1);
      if (other.fly === "fruit") {
        sliceFruit(other, x1, y1, x2, y2);
      } else if (other.fly === "bomb" || other.fly === "bigbomb") {
        splashes.push({ x: other.x, y: other.y, life: 0.5, color: "#c8c8d2" });
        addFloat(other.x, other.y, "炸弹被排掉啦!", "#4a9a5a");
      } else if (other.fly === "banana") {
        sliceBanana(other);
      } else if (other.fly === "ice") {
        sliceIce(other);
      }
    }
  }

  function slice(x1: number, y1: number, x2: number, y2: number): void {
    if (phase !== "play") return;
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      if (!segCircleHit(x1, y1, x2, y2, f.x, f.y, f.r + 6)) continue;
      flying.splice(i, 1);
      if (f.fly === "bomb" || f.fly === "bigbomb") {
        sliceBomb(f, f.fly === "bigbomb");
        if (phase !== "play") return;
      } else if (f.fly === "banana") {
        sliceBanana(f);
      } else if (f.fly === "ice") {
        sliceIce(f);
      } else if (f.fly === "boom") {
        sliceBoom(f, x1, y1, x2, y2);
        if (checkClassicTarget()) return;
      } else {
        sliceFruit(f, x1, y1, x2, y2);
        if (checkClassicTarget()) return;
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

    if (phase === "menu") {
      for (const m of menuRects) {
        if (inRect(x, y, m.rect)) {
          api.play("tap");
          startMode(m.mode);
          return;
        }
      }
      return;
    }
    if (phase === "themes") {
      if (inRect(x, y, btnBack)) {
        api.play("tap");
        phase = "menu";
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
        if (Math.hypot(x - n.x, y - n.y) <= n.r + 8) {
          if (isLevelUnlocked(progress, n.idx)) {
            api.play("tap");
            roundIdx = n.idx;
            resetRound();
            phase = "intro";
          } else {
            api.play("oops");
          }
          return;
        }
      }
      return;
    }
    if (phase === "intro") {
      api.play("tap");
      phase = "play";
      return;
    }
    if (phase === "clear") {
      if (inRect(x, y, btnNext)) {
        api.play("tap");
        roundIdx++;
        resetRound();
        phase = "intro";
      } else if (inRect(x, y, btnMap)) {
        api.play("tap");
        phase = "map";
      }
      return;
    }
    if (phase === "retry") {
      if (inRect(x, y, btnRetry)) {
        api.play("tap");
        resetRound();
        phase = "play";
      } else if (inRect(x, y, btnMap)) {
        api.play("tap");
        phase = "map";
      }
      return;
    }
    if (phase === "end") {
      if (inRect(x, y, btnRetry)) {
        api.play("tap");
        resetRound();
        totalScore = 0;
        phase = "intro";
      } else if (inRect(x, y, btnMenu)) {
        api.play("tap");
        phase = "menu";
      }
      return;
    }

    slicing = true;
    lastX = x;
    lastY = y;
    trail.push({ x: lastX, y: lastY, t: time });
  }

  function onPointerMove(e: PointerEvent): void {
    if (!slicing || destroyed) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    slice(lastX, lastY, x, y);
    lastX = x;
    lastY = y;
    trail.push({ x, y, t: time });
    if (trail.length > 16) trail.shift();
  }

  function onPointerUp(): void {
    slicing = false;
  }

  // ---- 更新 ----
  function update(rawDt: number): void {
    const scale = hitStop > 0 ? 0.3 : 1;
    hitStop = Math.max(0, hitStop - rawDt);
    const dt = rawDt * scale;
    time += dt;
    shake = Math.max(0, shake - rawDt);
    freezeTimer = Math.max(0, freezeTimer - rawDt);

    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= rawDt;
      floats[i].y -= rawDt * 32;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }
    while (trail.length > 0 && time - trail[0].t > 0.18) trail.shift();
    for (let i = splashes.length - 1; i >= 0; i--) {
      splashes[i].life -= dt;
      if (splashes[i].life <= 0) splashes.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].life -= rawDt;
      if (rings[i].life <= 0) rings.splice(i, 1);
    }

    if (phase !== "play") return;

    // 连击窗口计时
    if (comboClock > 0) {
      comboClock -= rawDt;
      if (comboClock <= 0) settleCombo();
    }

    // 倒计时(经典与禅宗)
    if (mode === "classic" || mode === "zen") {
      roundTime -= dt;
      if (roundTime <= 0) {
        if (mode === "zen") {
          endFreeMode();
        } else {
          settleCombo();
          if (roundScore >= round().target) roundCleared();
          else roundFail();
        }
        return;
      }
    }

    // 水果雨
    if (frenzyTimer > 0) {
      frenzyTimer -= dt;
      frenzyLaunch -= dt;
      if (frenzyLaunch <= 0 && flying.length < 12) {
        frenzyLaunch = 0.3;
        launchOne("fruit");
        if (Math.random() < 0.4) launchOne("fruit");
      }
    } else {
      launchTimer -= dt;
      const maxOn = mode === "classic" ? round().maxOnScreen : mode === "zen" ? 9 : 8;
      if (launchTimer <= 0 && flying.length < maxOn) {
        launchTimer = mode === "arcade" ? arcadePace(totalScore).interval : mode === "zen" ? 1.1 : 1.4;
        launchVolley();
      }
    }

    // 冰冻果:飞行物慢动作,好切!果园手感:重力倍率 + 侧风漂移。
    const st = orchardStyle();
    const simDt = dt * (freezeTimer > 0 ? ICE_SLOW : 1);
    const g = gravityFor(h) * st.gravityMult;
    const wind = st.wind;
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.vy += g * simDt;
      f.x += (f.vx + wind) * simDt;
      f.y += f.vy * simDt;
      f.rot += f.vrot * simDt;
      if (f.y > h + 80 && f.vy > 0) flying.splice(i, 1);
    }

    for (let i = halves.length - 1; i >= 0; i--) {
      const half = halves[i];
      half.vy += g * simDt;
      half.x += (half.vx + wind) * simDt;
      half.y += half.vy * simDt;
      half.rot += half.vrot * simDt;
      half.life -= dt;
      if (half.life <= 0 || half.y > h + 80) halves.splice(i, 1);
    }
  }

  // ---- 绘制 ----
  function drawBomb(f: Flying, big: boolean): void {
    ctx.fillStyle = big ? "#4a4258" : "#5c6b8a";
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    if (big) {
      // 大炸弹:红色警戒条纹
      ctx.strokeStyle = "#e05a7a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, f.r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#e05a7a";
      ctx.font = `bold ${f.r * 0.7}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", 0, f.r * 0.05);
    }
    ctx.strokeStyle = "#3a4258";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -f.r);
    ctx.quadraticCurveTo(f.r * 0.4, -f.r * 1.4, f.r * 0.7, -f.r * 1.2);
    ctx.stroke();
    ctx.fillStyle = "#ffd868";
    ctx.beginPath();
    ctx.arc(f.r * 0.7, -f.r * 1.2, 5 + Math.sin(time * 20) * 2, 0, Math.PI * 2);
    ctx.fill();
    if (!big) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-f.r * 0.3, -f.r * 0.15, f.r * 0.14, 0, Math.PI * 2);
      ctx.arc(f.r * 0.3, -f.r * 0.15, f.r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, f.r * 0.3, f.r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBanana(f: Flying): void {
    ctx.shadowColor = "#ffe66b";
    ctx.shadowBlur = 18 + Math.sin(time * 8) * 6;
    ctx.fillStyle = "#ffe66b";
    ctx.beginPath();
    ctx.moveTo(-f.r, -f.r * 0.1);
    ctx.quadraticCurveTo(0, f.r * 0.9, f.r, -f.r * 0.1);
    ctx.quadraticCurveTo(f.r * 0.85, f.r * 0.45, 0, f.r * 0.55);
    ctx.quadraticCurveTo(-f.r * 0.85, f.r * 0.45, -f.r, -f.r * 0.1);
    ctx.fill();
    ctx.shadowBlur = 0;
    const bands = ["#ff9eb5", "#8fd8c8", "#c9b6f2"];
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = bands[i];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -f.r * 0.15, f.r * (0.45 + i * 0.16), Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillStyle = "#c8a838";
    ctx.beginPath();
    ctx.arc(-f.r * 0.95, -f.r * 0.1, f.r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawIce(f: Flying): void {
    ctx.shadowColor = "#bfe9ff";
    ctx.shadowBlur = 14 + Math.sin(time * 6) * 5;
    ctx.fillStyle = "#bfe9ff";
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 雪花
    ctx.strokeStyle = "#5a8ac9";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * f.r * 0.65, Math.sin(a) * f.r * 0.65);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * f.r * 0.4, Math.sin(a) * f.r * 0.4);
      ctx.lineTo(Math.cos(a + 0.4) * f.r * 0.58, Math.sin(a + 0.4) * f.r * 0.58);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(-f.r * 0.3, -f.r * 0.3, f.r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBoomFruit(f: Flying): void {
    ctx.shadowColor = "#ffb84d";
    ctx.shadowBlur = 12 + Math.sin(time * 10) * 6;
    ctx.fillStyle = "#ff8f5e";
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 星星裂纹
    ctx.strokeStyle = "#e05a2a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * f.r * 0.2, Math.sin(a) * f.r * 0.2);
      ctx.lineTo(Math.cos(a) * f.r * 0.75, Math.sin(a) * f.r * 0.75);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffe0a3";
    ctx.beginPath();
    ctx.arc(0, 0, f.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // 小叶子
    ctx.fillStyle = "#7ac97a";
    ctx.beginPath();
    ctx.ellipse(f.r * 0.2, -f.r * 1.02, f.r * 0.28, f.r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFruit(f: Flying): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    if (f.fly === "bomb" || f.fly === "bigbomb") {
      drawBomb(f, f.fly === "bigbomb");
      ctx.restore();
      return;
    }
    if (f.fly === "banana") {
      drawBanana(f);
      ctx.restore();
      return;
    }
    if (f.fly === "ice") {
      drawIce(f);
      ctx.restore();
      return;
    }
    if (f.fly === "boom") {
      drawBoomFruit(f);
      ctx.restore();
      return;
    }
    const k = f.kind as FruitKind;
    ctx.fillStyle = k.skin;
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7ac97a";
    ctx.beginPath();
    ctx.ellipse(f.r * 0.2, -f.r * 1.02, f.r * 0.3, f.r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(-f.r * 0.3, -f.r * 0.3, f.r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(-f.r * 0.28, -f.r * 0.05, f.r * 0.09, 0, Math.PI * 2);
    ctx.arc(f.r * 0.28, -f.r * 0.05, f.r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.5, f.r * 0.07);
    ctx.beginPath();
    ctx.arc(0, f.r * 0.18, f.r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawHalf(half: Half): void {
    ctx.save();
    ctx.translate(half.x, half.y);
    ctx.rotate(half.rot);
    ctx.globalAlpha = Math.min(1, half.life / 0.5);
    ctx.fillStyle = half.skin;
    ctx.beginPath();
    ctx.arc(0, 0, half.r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = half.flesh;
    ctx.beginPath();
    ctx.ellipse(0, 0, half.r, half.r * 0.32, 0, 0, Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawTrail(): void {
    if (trail.length < 2) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < trail.length; i++) {
      const age = time - trail[i].t;
      const alpha = Math.max(0, 1 - age / 0.18);
      const width = 10 * (i / trail.length) + 2;
      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = "#ff9eb5";
      ctx.lineWidth = width + 6;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function panelBox(pw: number, ph: number): { x: number; y: number } {
    const x = (w - pw) / 2;
    const y = h / 2 - ph / 2;
    ctx.fillStyle = "rgba(255,248,240,0.87)";
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
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  }

  function drawMenu(): void {
    ctx.fillStyle = "rgba(255,248,240,0.94)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c47a2a";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍑 水果切切乐", w / 2, h * 0.14);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#8a7a5e";
    ctx.fillText("手指划过水果,唰!连切有爆击,炸弹别碰!", w / 2, h * 0.14 + 34);

    menuRects.length = 0;
    const bw = Math.min(380, w - 60);
    const configs: Array<{ mode: Mode; title: string; sub: string; color: string }> = [
      {
        mode: "classic",
        title: "🏅 经典战役",
        sub: `九大果园 ${ROUNDS.length} 回合 · ⭐ ${totalStars(progress)}/${ROUNDS.length * 3}`,
        color: "#ffb84d",
      },
      {
        mode: "zen",
        title: "🧘 禅宗模式",
        sub: `${ZEN_SECONDS} 秒没有炸弹,安心切 · 最好 ${best.zen} 分`,
        color: "#8fd8c8",
      },
      {
        mode: "arcade",
        title: "🎪 街机无尽",
        sub: `越切越快,挑战最高分 · 最好 ${best.arcade} 分`,
        color: "#b28ae8",
      },
    ];
    const cardH = Math.min(88, (h * 0.66) / configs.length - 12);
    for (let i = 0; i < configs.length; i++) {
      const c = configs[i];
      const rect: Rect = { x: (w - bw) / 2, y: h * 0.26 + i * (cardH + 16), w: bw, h: cardH };
      menuRects.push({ mode: c.mode, rect });
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "bold 21px sans-serif";
      ctx.fillText(c.title, w / 2, rect.y + cardH * 0.36);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#9a9aa8";
      ctx.fillText(c.sub, w / 2, rect.y + cardH * 0.7);
    }
  }

  function drawThemes(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#fdf3e0");
    grad.addColorStop(1, "#ffd9e5");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#c47a2a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍑 经典战役 · 九大果园", w / 2, 26);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#8a7a5e";
    ctx.fillText(
      `共 ${ROUNDS.length} 回合 · ⭐ ${totalStars(progress)}/${ROUNDS.length * 3} · 先选果园,再选回合`,
      w / 2,
      52,
    );

    btnBack = { x: 8, y: 8, w: 70, h: 32 };
    drawButton(btnBack, "◀ 菜单", "rgba(255,255,255,0.9)", "#5a5a6e");

    themeCards.length = 0;
    const cols = w > h * 1.15 ? 3 : 2;
    const rows = Math.ceil(ORCHARD_ORDER.length / cols);
    const pad = 10;
    const x0 = Math.max(10, w * 0.06);
    const y0 = 70;
    const cw = (w - x0 * 2 - pad * (cols - 1)) / cols;
    const ch = Math.min(96, (h - y0 - 16 - pad * (rows - 1)) / rows);
    for (let i = 0; i < ORCHARD_ORDER.length; i++) {
      const st = ORCHARD_STYLE[ORCHARD_ORDER[i]];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rect: Rect = { x: x0 + col * (cw + pad), y: y0 + row * (ch + pad), w: cw, h: ch };
      themeCards.push({ idx: i, rect });
      const unlocked = isThemeUnlocked(progress, i);
      const cleared = themeCleared(progress, i);
      ctx.fillStyle = unlocked ? st.bgTop : "#e8e8ee";
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
      ctx.fillStyle = unlocked ? (isDarkOrchard(i) ? "#f0e8da" : "#5a5a6e") : "#a8a8b4";
      ctx.fillText(unlocked ? st.blurb : "通关上一个果园解锁", rect.x + 10, rect.y + ch * 0.6);
      ctx.fillText(
        unlocked
          ? `${cleared}/${LEVELS_PER_THEME} 回合 · ⭐${themeStars(progress, i)}/${LEVELS_PER_THEME * 3}`
          : "",
        rect.x + 10,
        rect.y + ch * 0.82,
      );
    }
  }

  function drawMap(): void {
    const st = ORCHARD_STYLE[ORCHARD_ORDER[chapterIdx]];
    const dark = isDarkOrchard(chapterIdx);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, st.bgTop);
    grad.addColorStop(1, st.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    btnBack = { x: 8, y: 8, w: 70, h: 32 };
    drawButton(btnBack, "◀ 果园", "rgba(255,255,255,0.9)", "#5a5a6e");

    ctx.fillStyle = dark ? "#ffe8c2" : st.accent;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${st.emoji} 第${chapterIdx + 1}章 · ${st.name}`, w / 2, 28);
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `⭐ ${themeStars(progress, chapterIdx)}/${LEVELS_PER_THEME * 3} · 不掉心通关 3 星,回放可刷星`,
      w / 2,
      54,
    );

    mapNodes.length = 0;
    const base = chapterIdx * LEVELS_PER_THEME;
    const cols = 4;
    const rows = Math.ceil(LEVELS_PER_THEME / cols);
    const mx0 = w * 0.12;
    const mx1 = w * 0.88;
    const my0 = 96;
    const my1 = h - 40;
    const nr = Math.max(16, Math.min(28, (mx1 - mx0) / cols / 2.4, (my1 - my0) / rows / 2.6));
    for (let i = 0; i < LEVELS_PER_THEME; i++) {
      const row = Math.floor(i / cols);
      const colRaw = i % cols;
      const col = row % 2 === 0 ? colRaw : cols - 1 - colRaw;
      const x = mx0 + ((mx1 - mx0) * col) / (cols - 1);
      const y = my0 + (rows === 1 ? 0 : ((my1 - my0) * row) / (rows - 1));
      mapNodes.push({ idx: base + i, x, y, r: nr });
    }
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
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
    for (const n of mapNodes) {
      const def = ROUNDS[n.idx];
      const unlocked = isLevelUnlocked(progress, n.idx);
      const got = progress[n.idx] ?? 0;
      const isFinal = n.idx - base === LEVELS_PER_THEME - 1;
      const r = isFinal ? n.r * 1.25 : n.r;
      ctx.fillStyle = unlocked ? (got > 0 ? "#ffe8c2" : "#ffffff") : "rgba(230,230,236,0.92)";
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
        ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`;
        ctx.fillText(String(n.idx - base + 1), n.x, n.y);
        if (isFinal) {
          ctx.font = `${Math.round(r * 0.6)}px sans-serif`;
          ctx.fillText(chapterIdx === ORCHARD_ORDER.length - 1 ? "🏆" : "🚩", n.x, n.y - r * 0.95);
        } else if (def.gen) {
          ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
          ctx.fillText("🍲", n.x, n.y - r * 0.95);
        }
        ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
        let starTxt = "";
        for (let s = 0; s < 3; s++) starTxt += s < got ? "⭐" : "▫";
        ctx.fillText(starTxt, n.x, n.y + r * 1.45);
      }
    }
  }

  function drawIntroPanel(): void {
    const { y } = panelBox(Math.min(460, w - 40), 210);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (mode === "classic") {
      const r = round();
      const st = ORCHARD_STYLE[r.orchard];
      const rel = roundIdx - chapterIdx * LEVELS_PER_THEME + 1;
      ctx.fillStyle = st.accent;
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(`${st.emoji} 第${chapterIdx + 1}章 第${rel}回合 · ${r.name}`, w / 2, y + 40);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "15px sans-serif";
      ctx.fillText(r.hint, w / 2, y + 82);
      const tags: string[] = [];
      if (st.wind > 0) tags.push("💨 侧风向右");
      if (st.wind < 0) tags.push("💨 侧风向左");
      if (st.gravityMult < 1) tags.push("🎈 低重力飘");
      if (st.gravityMult > 1) tags.push("⚡ 急坠快落");
      if (st.fruitScale < 1) tags.push("🔍 小果考精准");
      if (st.fruitScale > 1) tags.push("🍉 大瓜好切");
      if (tags.length > 0) {
        ctx.fillStyle = "#8a7a5e";
        ctx.font = "13px sans-serif";
        ctx.fillText(tags.join(" · "), w / 2, y + 108);
      }
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(`🎯 ${r.time} 秒内切到 ${r.target} 分`, w / 2, y + 134);
    } else if (mode === "zen") {
      ctx.fillStyle = "#8fd8c8";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("🧘 禅宗模式", w / 2, y + 42);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "16px sans-serif";
      ctx.fillText(`${ZEN_SECONDS} 秒里没有炸弹,安安心心切个够!`, w / 2, y + 86);
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("🎯 冲 40/80/130 分拿 1/2/3 星", w / 2, y + 122);
    } else {
      ctx.fillStyle = "#b28ae8";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("🎪 街机无尽", w / 2, y + 42);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "16px sans-serif";
      ctx.fillText("没有时间限制,3 颗心用完为止,越切越快!", w / 2, y + 86);
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("🎯 冲 40/90/150 分拿 1/2/3 星", w / 2, y + 122);
    }
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    ctx.fillText("点一下开始,唰唰唰!", w / 2, y + 162);
  }

  function drawClearPanel(): void {
    const r = round();
    const { y } = panelBox(Math.min(450, w - 40), 240);
    ctx.fillStyle = "#4a9a5a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${r.name} 完成!`, w / 2, y + 40);
    ctx.font = "34px sans-serif";
    let starTxt = "";
    for (let s = 0; s < 3; s++) starTxt += s < earnedStars ? "⭐" : "☆";
    ctx.fillText(starTxt, w / 2, y + 86);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(`本回合 ${roundScore} 分 · 掉心 ${heartsLost} · 最高 ${bestCombo} 连切`, w / 2, y + 124);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 164, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    if (roundIdx < ROUNDS.length - 1) {
      btnNext = { x: w / 2 + 10, y: y + 164, w: bw2, h: 44 };
      drawButton(btnNext, "下一回合 ▶", "#ffd868", "#7a5a1a");
    } else {
      btnNext = null;
    }
  }

  function drawRetryPanel(): void {
    const { y } = panelBox(Math.min(450, w - 40), 210);
    ctx.fillStyle = "#b28ae8";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("差一点点……", w / 2, y + 44);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText("没关系!重切这一回合就好", w / 2, y + 84);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 128, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: y + 128, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再切一次", "#ffd868", "#7a5a1a");
  }

  function drawEndPanel(): void {
    const { y } = panelBox(Math.min(450, w - 40), 250);
    ctx.fillStyle = mode === "zen" ? "#4a9a8a" : "#8a5ac9";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mode === "zen" ? "禅宗时间到!" : "街机挑战结束!", w / 2, y + 40);
    ctx.font = "34px sans-serif";
    let starTxt = "";
    for (let s = 0; s < 3; s++) starTxt += s < endStars ? "⭐" : "☆";
    ctx.fillText(starTxt, w / 2, y + 86);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    const bestScore = mode === "zen" ? best.zen : best.arcade;
    ctx.fillText(`本局 ${totalScore} 分 · 最好 ${bestScore} 分 · 最高 ${bestCombo} 连切`, w / 2, y + 124);
    const bw2 = 132;
    btnMenu = { x: w / 2 - bw2 - 10, y: y + 168, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: y + 168, w: bw2, h: 44 };
    drawButton(btnMenu, "回菜单", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再来一局", "#ffd868", "#7a5a1a");
  }

  function draw(): void {
    if (phase === "menu") {
      drawMenu();
      return;
    }
    if (phase === "themes") {
      drawThemes();
      return;
    }
    if (phase === "map") {
      drawMap();
      return;
    }

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 16);

    const st = orchardStyle();
    const dark = mode === "classic" && isDarkOrchard(chapterIdx);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (freezeTimer > 0) {
      grad.addColorStop(0, "#e0f2ff");
      grad.addColorStop(1, "#cfe6ff");
    } else if (frenzyTimer > 0) {
      grad.addColorStop(0, "#fff3d6");
      grad.addColorStop(1, "#ffe0ee");
    } else {
      grad.addColorStop(0, st.bgTop);
      grad.addColorStop(1, st.bgBottom);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(-24, -24, w + 48, h + 48);

    ctx.fillStyle =
      freezeTimer > 0
        ? "rgba(140,190,240,0.22)"
        : dark
          ? "rgba(255,255,255,0.10)"
          : "rgba(255,180,200,0.18)";
    for (let y = 30; y < h; y += 70) {
      for (let x = ((y / 70) % 2) * 35 + 20; x < w; x += 70) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (freezeTimer > 0) {
      // 飘雪
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i < 20; i++) {
        const sx = ((i * 97) % 100) / 100 * w;
        const sy = (((i * 53) % 100) / 100 * h + time * 40) % h;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (st.wind !== 0 && freezeTimer <= 0) {
      // 侧风线条:提示水果会横向漂移
      ctx.strokeStyle = dark ? "rgba(255,220,180,0.35)" : "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      const dir = Math.sign(st.wind);
      for (let i = 0; i < 8; i++) {
        const wy = (((i * 131) % 100) / 100) * h * 0.8 + h * 0.06;
        const phaseX = ((time * Math.abs(st.wind) * 1.6 + i * 160) % (w + 200)) - 100;
        const wx = dir > 0 ? phaseX : w - phaseX;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 18 * dir, wy - 4, wx + 40 * dir, wy);
        ctx.stroke();
      }
    }

    for (const half of halves) drawHalf(half);
    for (const f of flying) drawFruit(f);

    for (const s of splashes) {
      ctx.globalAlpha = Math.max(0, s.life) * 0.9;
      ctx.fillStyle = s.color;
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        const d = (0.8 - s.life) * 70;
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    for (const r of rings) {
      ctx.globalAlpha = Math.max(0, r.life / 0.7);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, (1 - Math.max(0, r.life) / 0.7) * r.maxR + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    drawTrail();

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 24px sans-serif" : "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ---- HUD ----
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(10, 10, Math.min(290, w * 0.52), 40, 17);
    ctx.fill();
    ctx.fillStyle = "#c47a2a";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    if (mode === "classic") {
      const rel = roundIdx - chapterIdx * LEVELS_PER_THEME + 1;
      ctx.fillText(
        `第${chapterIdx + 1}章 ${rel}/${LEVELS_PER_THEME} · 🍑 ${roundScore}/${round().target}`,
        24,
        30,
      );
    } else if (mode === "zen") {
      ctx.fillText(`禅宗 · 分 ${totalScore}`, 24, 30);
    } else {
      ctx.fillText(`街机 · 分 ${totalScore}`, 24, 30);
    }
    if (mode !== "zen") {
      ctx.textAlign = "right";
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        "💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, HEARTS_PER_ROUND - hearts)),
        w - 12,
        30,
      );
    }

    // 时间条(经典与禅宗)
    if ((mode === "classic" || mode === "zen") && phase === "play") {
      const full = mode === "classic" ? round().time : ZEN_SECONDS;
      const tw = Math.min(240, w - 340);
      if (tw > 60) {
        const tx = (w - tw) / 2 + 30;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.roundRect(tx, 16, tw, 12, 6);
        ctx.fill();
        const frac = Math.max(0, roundTime / full);
        ctx.fillStyle = frac < 0.25 ? "#e05a7a" : "#8fd8c8";
        ctx.beginPath();
        ctx.roundRect(tx, 16, Math.max(12, tw * frac), 12, 6);
        ctx.fill();
      } else {
        ctx.textAlign = "center";
        ctx.fillStyle = roundTime < 10 ? "#e05a7a" : "#5a5a6e";
        ctx.fillText(`${Math.ceil(roundTime)}s`, w / 2, 54);
      }
    }

    if (frenzyTimer > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#e0a030";
      ctx.font = `bold ${20 + Math.sin(time * 10) * 3}px sans-serif`;
      ctx.fillText(`🍌 水果雨 ×${FRENZY_MULTIPLIER} ${Math.ceil(frenzyTimer)}s`, w / 2, 70);
    }
    if (freezeTimer > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#5a8ac9";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(`❄ 慢动作 ${Math.ceil(freezeTimer)}s`, w / 2, frenzyTimer > 0 ? 96 : 70);
    }

    // ---- 覆盖层 ----
    if (phase === "intro") drawIntroPanel();
    else if (phase === "clear") drawClearPanel();
    else if (phase === "retry") drawRetryPanel();
    else if (phase === "end") drawEndPanel();
  }

  let raf = 0;
  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    syncSize();
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.remove();
    },
  };
}
