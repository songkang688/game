/**
 * 冰冰火火森林 · 实玩模拟(不开浏览器,但按真实键位一步一步走完整关)。
 *
 * 三件要证明的事:
 *  1. 双人同屏:两套键位各按各的,谁也抢不到谁的角色;
 *  2. 单人 Tab:一个人靠切换角色也能把关卡从头走到尾;
 *  3. 三星路线:先绕路收齐宝石再一起进门,时间够用、心一颗都不用掉。
 */
import { describe, expect, it } from "vitest";
import { analyzeLevel } from "./levels";
import {
  ACTION_DIR,
  KEY_MAP,
  MAX_HEARTS,
  MOVE_SECONDS,
  gemOwner,
  initialState,
  isWin,
  moveHero,
  parseLevel,
  rateRun,
  searchFrom,
  solveLevel,
  threeStarSeconds,
  type GameState,
  type Hero,
  type ParsedLevel,
  type SolutionStep,
} from "./logic";

/** 方向号 → 该角色对应的物理按键 */
function keyFor(hero: Hero, dir: number): string {
  for (const [code, bind] of Object.entries(KEY_MAP)) {
    if (bind.hero !== hero) continue;
    if (ACTION_DIR[bind.action] === dir) return code;
  }
  throw new Error(`找不到 ${hero} 往 ${dir} 的按键`);
}

/** 双人模式:按下哪个键,就由那个键的主人动 */
function pressDuo(level: ParsedLevel, st: GameState, code: string): GameState {
  const bind = KEY_MAP[code];
  const out = moveHero(level, st, bind.hero, ACTION_DIR[bind.action]);
  expect(out.kind, `按 ${code} 应该走得动`).toBe("moved");
  return out.state;
}

interface SoloRun {
  state: GameState;
  tabs: number;
  presses: number;
}

/**
 * 单人模式:两套键位都指挥「当前这一位」,要换人得先按 Tab。
 * 求解器本来就是「一次动一个人」搜出来的,所以任何一条解都能这样照着走。
 */
function playSolo(level: ParsedLevel, path: SolutionStep[]): SoloRun {
  let st = initialState(level);
  let active: Hero = "ice";
  let tabs = 0;
  let presses = 0;
  for (const step of path) {
    if (step.hero !== active) {
      active = active === "ice" ? "fire" : "ice";
      tabs++;
    }
    expect(active).toBe(step.hero);
    // 单人模式下两套键位都开当前这位,这里故意轮流用,证明两套都认
    const code = keyFor(presses % 2 === 0 ? "ice" : "fire", step.dir);
    const dir = ACTION_DIR[KEY_MAP[code].action];
    const out = moveHero(level, st, active, dir);
    expect(out.kind, `单人第 ${presses + 1} 步`).toBe("moved");
    st = out.state;
    presses++;
  }
  return { state: st, tabs, presses };
}

/** 每一章挑一关来实玩:头一关、中间一关、最后一关 */
const SAMPLE_LEVELS = [0, 12, 23, 24, 36, 47, 48, 60, 71, 72, 84, 95, 96, 107, 118, 119, 130, 141, 142, 153, 164, 165, 176, 187];

describe("双人同屏键盘", () => {
  it("两套键位各按各的,互不抢占", () => {
    const level = parseLevel(analyzeLevel(0).grid);
    let st = initialState(level);
    const before = { ...st };
    st = pressDuo(level, st, "KeyD");
    expect(st.fire).toBe(before.fire);
    const afterIce = st.ice;
    st = pressDuo(level, st, "ArrowUp");
    expect(st.ice).toBe(afterIce);
    expect(st.fire).not.toBe(before.fire);
  });

  it("照着解法一步一步按,双人模式能真的把第 1 关打通", () => {
    const level = parseLevel(analyzeLevel(0).grid);
    const res = solveLevel(level, true);
    expect(res.solvable).toBe(true);
    expect(res.path).not.toBeNull();
    let st = initialState(level);
    for (const step of res.path!) {
      st = pressDuo(level, st, keyFor(step.hero, step.dir));
    }
    expect(isWin(level, st)).toBe(true);
  });
});

describe("单人 Tab 切换", () => {
  it("一个人也能把每一章的样本关走到通关", () => {
    for (const lv of SAMPLE_LEVELS) {
      const level = parseLevel(analyzeLevel(lv).grid);
      const res = solveLevel(level, true);
      expect(res.solvable, `第 ${lv + 1} 关`).toBe(true);
      const run = playSolo(level, res.path!);
      expect(isWin(level, run.state), `第 ${lv + 1} 关单人通关`).toBe(true);
      expect(run.presses).toBe(res.steps);
      expect(run.tabs).toBeGreaterThan(0);
    }
  }, 180000);

  it("换人次数比总步数少得多,不至于按 Tab 按到手酸", () => {
    for (const lv of SAMPLE_LEVELS) {
      const level = parseLevel(analyzeLevel(lv).grid);
      const res = solveLevel(level, true);
      const run = playSolo(level, res.path!);
      expect(run.tabs).toBeLessThan(run.presses);
    }
  }, 180000);
});

describe("三星路线走得出来", () => {
  it("样本关:收齐宝石再进门,时间落在三星线内、一颗心都不用掉", () => {
    for (const lv of SAMPLE_LEVELS) {
      const a = analyzeLevel(lv);
      const level = parseLevel(a.grid);
      let st = initialState(level);
      const left = new Map(level.gems.map((g) => [g.pos, g.kind]));
      let steps = 0;

      while (left.size > 0) {
        const res = searchGem(level, st, left);
        expect(res, `第 ${lv + 1} 关还有宝石够不着`).not.toBeNull();
        st = res!.state;
        steps += res!.steps;
        for (const pos of [st.ice, st.fire]) {
          const kind = left.get(pos);
          if (!kind) continue;
          const owner = gemOwner(kind);
          if (owner === "both" || (owner === "ice" ? pos === st.ice : pos === st.fire)) {
            left.delete(pos);
          }
        }
      }

      const home = searchFromWin(level, st);
      expect(home, `第 ${lv + 1} 关收完宝石回不了门`).not.toBeNull();
      steps += home!.steps;

      const seconds = Math.round(steps * MOVE_SECONDS);
      expect(seconds, `第 ${lv + 1} 关三星用时`).toBeLessThanOrEqual(threeStarSeconds(a.steps));
      const stars = rateRun({
        gems: a.totalGems,
        totalGems: a.totalGems,
        seconds,
        steps: a.steps,
        hearts: MAX_HEARTS,
      });
      expect(stars, `第 ${lv + 1} 关`).toBe(3);
    }
  }, 180000);
});

function searchGem(
  level: ParsedLevel,
  st: GameState,
  left: Map<number, "blue" | "red" | "white">
): { state: GameState; steps: number } | null {
  return searchFromImpl(level, st, (s) => {
    for (const [pos, kind] of left) {
      const owner = gemOwner(kind);
      if ((owner === "ice" || owner === "both") && s.ice === pos) return true;
      if ((owner === "fire" || owner === "both") && s.fire === pos) return true;
    }
    return false;
  });
}

function searchFromWin(level: ParsedLevel, st: GameState): { state: GameState; steps: number } | null {
  return searchFromImpl(level, st, (s) => isWin(level, s));
}

function searchFromImpl(
  level: ParsedLevel,
  st: GameState,
  goal: (s: GameState) => boolean
): { state: GameState; steps: number } | null {
  const res = searchFrom(level, st, goal);
  return res.found && res.state ? { state: res.state, steps: res.steps } : null;
}
