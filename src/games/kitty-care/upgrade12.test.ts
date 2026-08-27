/**
 * 萌猫小屋 · 1.2 升级用例。
 *
 * 盯的是这一步新写的那几样：拆出来的纯函数层（`tasks.ts` / `cat.ts` /
 * `album.ts` / `endless.ts` / `runtime.ts`）、心情归零改成躲纸箱、
 * 多猫目标锁定、看病词表安全、搭配规则表、相册 24 件、照顾马拉松，
 * 外加两条回归红线：**前 99 关一个字都没动**、`destroy` 之后什么都不剩。
 *
 * 既有的 `levels.test.ts` / `levels188.test.ts` 一条都没删。
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { save } from "../../engine/save";
import { totalSize, TOTAL_LEVELS } from "../level99";
import { meta } from "./meta";
import guide from "./guide";
import {
  CHAPTERS,
  CURE_SAFETY_LINE,
  CURE_TOOLS,
  LEGACY_LEVELS,
  LEVELS,
  STYLE_THEMES,
  STYLE_WARDROBE,
  SYMPTOMS,
  buildCureRound,
  styleGrade
} from "./levels";
import {
  FACE_INFO,
  SOOTHE_TO_RETURN,
  catAfter,
  catLine,
  createCat,
  faceOf,
  finalStars,
  moodRatio,
  soothesLeft,
  starCap
} from "./cat";
import {
  ACCS,
  ALL_FOODS,
  BEAT_WINDOW_MS,
  DISLIKED_FOODS,
  POUNCE_INTEREST,
  SNAP_RADIUS,
  STYLE_PICKS,
  STYLE_RULES,
  WASH_TARGET,
  buildDress,
  buildFeed,
  buildPlay,
  buildSleep,
  buildWash,
  chaseHint,
  cureBack,
  cureHint,
  curePick,
  curePlan,
  cureStart,
  cureStepKind,
  dressDrop,
  feedDrop,
  judgeBeat,
  judgeStyleItem,
  nearestSnap,
  playStep,
  scoreOutfit,
  scrub,
  sleepTap,
  styleSlotCount,
  washCellCenter,
  washCoverage,
  type SnapPoint
} from "./tasks";
import {
  ALBUM_KEY,
  ALBUM_PIECES,
  ALBUM_TOTAL,
  AlbumStore,
  HOME_SPOTS,
  nextDrop,
  parseAlbum,
  sanitizeAlbum,
  serializeAlbum,
  shareWalletWithCollection,
  unlockCost
} from "./album";
import {
  ENDLESS_MAX_CATS,
  ENDLESS_MIN_SEC,
  ENDLESS_ORDER,
  endlessLine,
  endlessParams,
  endlessRound,
  endlessScore,
  endlessTimeout
} from "./endless";
import {
  Life,
  openLevelOnMap,
  parseLevelParam,
  prefersReducedMotion,
  resolveInitialLevel,
  type MapHostLike,
  type MapNodeLike,
  type TimerHost
} from "./runtime";
import { Arena } from "./arena";
import { KTC_CSS } from "./styles";
import {
  fakeWallet,
  findByLabel,
  findOne,
  installDom,
  memoryStorage,
  totalListeners,
  type InstalledDom,
  type StubEl
} from "./domStub";

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

const DIR = dirname(fileURLToPath(import.meta.url));

/** 本目录里的玩法源码（测试与测试桩不算） */
const SOURCE_FILES = readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "domStub.ts")
  .sort();

function readSource(file: string): string {
  return readFileSync(join(DIR, file), "utf8");
}

/** 去掉注释，只留真正会跑到屏幕上的代码 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

/** 假时钟：所有 timer / rAF 都攥在手里，测得出 `destroy` 之后还剩几个 */
class FakeClock {
  private seq = 1;
  readonly timers = new Map<number, () => void>();
  readonly loops = new Map<number, () => void>();
  readonly frames = new Map<number, (t: number) => void>();

  setTimeout(fn: () => void): ReturnType<typeof setTimeout> {
    const id = this.seq++;
    this.timers.set(id, fn);
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearTimeout(id: ReturnType<typeof setTimeout>): void {
    this.timers.delete(id as unknown as number);
  }

  setInterval(fn: () => void): ReturnType<typeof setTimeout> {
    const id = this.seq++;
    this.loops.set(id, fn);
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearInterval(id: ReturnType<typeof setTimeout>): void {
    this.loops.delete(id as unknown as number);
  }

  requestAnimationFrame(fn: (t: number) => void): number {
    const id = this.seq++;
    this.frames.set(id, fn);
    return id;
  }

  cancelAnimationFrame(id: number): void {
    this.frames.delete(id);
  }

  /** 把所有到期的延时跑一遍 */
  runTimers(): void {
    const list = [...this.timers.values()];
    this.timers.clear();
    for (const fn of list) fn();
  }

  get alive(): number {
    return this.timers.size + this.loops.size + this.frames.size;
  }
}

function newLife(clock: FakeClock): Life {
  return new Life(clock as unknown as TimerHost);
}

// ---------------------------------------------------------------------------
// 一、630 行的 index.ts 拆开了
// ---------------------------------------------------------------------------

describe("萌猫小屋 1.2 · index.ts 拆分", () => {
  it("判定层与渲染层各自成文件，index.ts 只剩挂载", () => {
    for (const f of ["tasks.ts", "cat.ts", "catArt.ts", "styles.ts", "arena.ts", "album.ts", "endless.ts", "runtime.ts"]) {
      expect(SOURCE_FILES, `缺少拆分出来的 ${f}`).toContain(f);
      expect(readSource(f).split("\n").length, `${f} 不该是个空壳`).toBeGreaterThan(60);
    }
    const index = readSource("index.ts");
    expect(index.split("\n").length, "index.ts 还是太胖").toBeLessThan(560);
  });

  it("index.ts 里不再写任何一条任务判定（判定全在 tasks.ts）", () => {
    const index = stripComments(readSource("index.ts"));
    for (const fn of ["feedDrop(", "playStep(", "scrub(", "sleepTap(", "dressDrop(", "curePick(", "judgeStyleItem("]) {
      expect(index.includes(fn), `index.ts 里还留着 ${fn}`).toBe(false);
    }
    // 反过来：这些判定确实都住在 tasks.ts 里
    const tasks = readSource("tasks.ts");
    for (const fn of ["export function feedDrop", "export function playStep", "export function scrub", "export function sleepTap", "export function dressDrop", "export function curePick", "export function judgeStyleItem"]) {
      expect(tasks).toContain(fn);
    }
  });

  it("新样式一律 ktc- 前缀，代码里挂的类名也一样", () => {
    const selectors = [...KTC_CSS.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]);
    expect(selectors.length).toBeGreaterThan(40);
    for (const cls of new Set(selectors)) expect(cls.startsWith("ktc-"), `样式里混进了 .${cls}`).toBe(true);

    const patterns = [
      /className\s*=\s*"([^"]*)"/g,
      /\bel\("[a-zA-Z]+",\s*"([^"]*)"/g,
      /\bbtn\("([^"]*)"/g,
      /classList\.(?:add|remove|toggle)\("([^"]*)"/g
    ];
    let seen = 0;
    for (const file of SOURCE_FILES) {
      const src = readSource(file);
      for (const re of patterns) {
        for (const hit of src.matchAll(re)) {
          for (const token of hit[1].split(/\s+/).filter(Boolean)) {
            seen++;
            expect(token.startsWith("ktc-"), `${file} 里挂了非 ktc- 的类名「${token}」`).toBe(true);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// 二、七种任务，七种手感
// ---------------------------------------------------------------------------

describe("萌猫小屋 1.2 · ①喂饭：挑对了才拖得进碗", () => {
  it("菜单里一定有它想吃的，也一定混着它不爱吃的", () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = buildFeed(seed, 4);
      expect(s.options).toContain(s.want);
      expect(s.want.liked).toBe(true);
      expect(s.options.some((f) => !f.liked), "得留一样它不爱吃的").toBe(true);
      expect(new Set(s.options.map((f) => f.name)).size).toBe(s.options.length);
      for (const f of s.options) expect(ALL_FOODS.map((x) => x.name)).toContain(f.name);
    }
  });

  it("拖对了就吃，拖到空地什么都不算，拖错只是摇头", () => {
    const s = buildFeed(7, 4);
    const wrongLiked = s.options.find((f) => f.liked && f.name !== s.want.name)!;
    const disliked = s.options.find((f) => !f.liked)!;

    const idle = feedDrop(s, s.want.name, false);
    expect(idle.acted).toBe(false);
    expect(idle.miss).toBe(false);
    expect(idle.done).toBe(false);

    const ok = feedDrop(s, s.want.name, true);
    expect(ok.done).toBe(true);
    expect(ok.miss).toBe(false);
    expect(ok.state.bowl).toBe(s.want.name);

    expect(feedDrop(s, wrongLiked.name, true).miss).toBe(true);
    expect(feedDrop(s, wrongLiked.name, true).done).toBe(false);
    const nope = feedDrop(s, disliked.name, true);
    expect(nope.miss).toBe(true);
    expect(nope.note).toContain(disliked.name);
    // 不在食谱里的东西：既不完成也不算错
    expect(feedDrop(s, "石头", true).miss).toBe(false);
    // 做完之后再拖也不会重复完成
    expect(feedDrop(ok.state, disliked.name, true).miss).toBe(false);
  });

  it("不爱吃的都是普通蔬果，不是会伤到猫的东西", () => {
    expect(DISLIKED_FOODS.length).toBeGreaterThanOrEqual(3);
    for (const f of DISLIKED_FOODS) {
      expect(f.liked).toBe(false);
      expect(f.name).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe("萌猫小屋 1.2 · ②逗猫：棒子不动就追不起来", () => {
  it("棒子举着不动，兴趣一路掉到 0，猫不会扑", () => {
    let s = buildPlay(3, { x: 0.5, y: 0.5 }, { x: 0.1, y: 0.1 });
    s = playStep(s, { x: 0.2, y: 0.5 }, 16).state;
    expect(s.interest).toBeGreaterThan(POUNCE_INTEREST);
    for (let i = 0; i < 20; i++) s = playStep(s, { x: 0.2, y: 0.5 }, 200).state;
    expect(s.interest).toBe(0);
    expect(s.pounces).toBe(0);
    expect(s.done).toBe(false);
  });

  it("甩起来再收到猫脚边，追上了才扑；扑够次数才算玩好", () => {
    let s = buildPlay(2, { x: 0.2, y: 0.5 }, { x: 0.5, y: 0.5 });
    let pounces = 0;
    let done = false;
    for (let i = 0; i < 12 && !done; i++) {
      s = playStep(s, { x: Math.min(1, s.cat.x + 0.3), y: s.cat.y }, 16).state;
      const res = playStep(s, { x: s.cat.x, y: s.cat.y }, 16);
      s = res.state;
      if (res.acted) pounces++;
      done = res.done;
    }
    expect(pounces).toBe(2);
    expect(done).toBe(true);
    expect(s.pounces).toBe(2);
  });

  it("兴趣提示分三档，都是催着玩不是催着赶", () => {
    const cold = buildPlay(3);
    expect(chaseHint(cold)).toContain("晃");
    expect(chaseHint({ ...cold, interest: 0.4 })).not.toBe(chaseHint(cold));
    expect(chaseHint({ ...cold, interest: 0.9 })).toContain("扑");
    for (const i of [0, 0.4, 0.9]) expect(chaseHint({ ...cold, interest: i })).not.toMatch(/快点|失败|来不及/);
  });
});

describe("萌猫小屋 1.2 · ③洗澡：画圈搓到九成", () => {
  it("一下画圈能搓掉一片格子，不是一格一格点", () => {
    const w = buildWash(6, 6);
    const res = scrub(w, 0.5, 0.5);
    expect(res.acted).toBe(true);
    expect(res.state.cells.filter(Boolean).length).toBeGreaterThan(3);
    // 同一处再搓：不算新进展，也不算做错
    const again = scrub(res.state, 0.5, 0.5);
    expect(again.acted).toBe(false);
    expect(again.miss).toBe(false);
  });

  it("覆盖率只增不减，卡在 90% 这条线上", () => {
    let w = buildWash(6, 6);
    let last = 0;
    for (let i = 0; i < 32; i++) {
      const c = washCellCenter(w, i);
      const res = scrub(w, c.x, c.y, 0.001);
      w = res.state;
      expect(washCoverage(w)).toBeGreaterThanOrEqual(last);
      last = washCoverage(w);
      expect(res.done, `搓到第 ${i + 1} 格就判完成了`).toBe(false);
    }
    expect(washCoverage(w)).toBeLessThan(WASH_TARGET);
    const c = washCellCenter(w, 32);
    const last33 = scrub(w, c.x, c.y, 0.001);
    expect(washCoverage(last33.state)).toBeGreaterThanOrEqual(WASH_TARGET);
    expect(last33.done).toBe(true);
    expect(last33.miss).toBe(false);
  });

  it("搓澡永远不会判失误，格子参数再离谱也不崩", () => {
    const w = buildWash(0, 0);
    expect(w.cols).toBe(1);
    expect(w.rows).toBe(1);
    expect(scrub(w, 5, 5).miss).toBe(false);
    expect(scrub(buildWash(6, 6), 9, 9).miss).toBe(false);
  });
});

describe("萌猫小屋 1.2 · ④哄睡：踩节拍", () => {
  it("节拍窗口是前后各 220 毫秒，边界上算踩上", () => {
    const s = buildSleep(3, 1000);
    expect(BEAT_WINDOW_MS).toBe(220);
    expect(judgeBeat(s, 1000)).toEqual({ index: 0, judge: "good" });
    expect(judgeBeat(s, 1000 + BEAT_WINDOW_MS).judge).toBe("good");
    expect(judgeBeat(s, 1000 - BEAT_WINDOW_MS).judge).toBe("good");
    expect(judgeBeat(s, 1000 + BEAT_WINDOW_MS + 1).judge).toBe("late");
    expect(judgeBeat(s, 1000 - BEAT_WINDOW_MS - 1).judge).toBe("early");
  });

  it("踩歪了不扣任何东西，踩满了才睡着", () => {
    let s = buildSleep(3, 1000);
    const early = sleepTap(s, 200);
    expect(early.miss).toBe(false);
    expect(early.acted).toBe(false);
    expect(early.state.hit.filter(Boolean)).toHaveLength(0);
    for (const t of [1000, 2000, 3000]) {
      const res = sleepTap(s, t);
      s = res.state;
      expect(res.miss).toBe(false);
      expect(res.acted).toBe(true);
    }
    expect(s.done).toBe(true);
    expect(s.hit.every(Boolean)).toBe(true);
    expect(judgeBeat(s, 1000).judge).toBe("none");
  });
});

describe("萌猫小屋 1.2 · ⑤打扮：拖到吸附点", () => {
  it("吸附热区半径 48px（直径 96），取最近的一个，够不着就是 null", () => {
    expect(SNAP_RADIUS).toBeGreaterThanOrEqual(48);
    const points: SnapPoint[] = [
      { id: "head", label: "头顶", x: 100, y: 100 },
      { id: "neck", label: "脖子", x: 160, y: 100 }
    ];
    expect(nearestSnap(points, 105, 100)?.id).toBe("head");
    expect(nearestSnap(points, 155, 100)?.id).toBe("neck");
    // 正好卡在半径上还够得着，多一像素就够不着了
    expect(nearestSnap([points[0]], 100, 100 + SNAP_RADIUS)?.id).toBe("head");
    expect(nearestSnap([points[0]], 100, 100 + SNAP_RADIUS + 1)).toBeNull();
    expect(nearestSnap(points, 100, 100 + SNAP_RADIUS + 1)).toBeNull();
    expect(nearestSnap([], 100, 100)).toBeNull();
  });

  it("放对位置戴对东西才成，放歪只是滑下来", () => {
    const s = buildDress(9, 4);
    const other = s.options.find((a) => a.id !== s.want.id)!;
    const elsewhere = s.want.spot === "head" ? "neck" : "head";

    expect(dressDrop(s, s.want.id, s.want.spot).done).toBe(true);
    expect(dressDrop(s, s.want.id, s.want.spot).state.worn).toBe(s.want.id);

    const loose = dressDrop(s, s.want.id, null);
    expect(loose.acted).toBe(false);
    expect(loose.miss).toBe(false);

    const wrongSpot = dressDrop(s, s.want.id, elsewhere);
    expect(wrongSpot.miss, "挂错地方不算做岔").toBe(false);
    expect(wrongSpot.done).toBe(false);

    const wrongAcc = dressDrop(s, other.id, other.spot);
    expect(wrongAcc.miss).toBe(true);
    expect(wrongAcc.note).toContain(other.name);
    expect(dressDrop(s, "不存在的东西", "head").acted).toBe(false);
  });

  it("四件配饰各有各的落点，名字里没有英文", () => {
    expect(ACCS).toHaveLength(4);
    expect(new Set(ACCS.map((a) => a.id)).size).toBe(4);
    expect(new Set(ACCS.map((a) => a.spot))).toEqual(new Set(["head", "neck"]));
    for (const a of ACCS) {
      expect(a.name).not.toMatch(/[A-Za-z]/);
      expect(a.cls.startsWith("ktc-")).toBe(true);
    }
  });
});

describe("萌猫小屋 1.2 · ⑥看病：分步、可回退、词表安全", () => {
  it("先看一看再动手，按顺序做完才收工", () => {
    const round = buildCureRound(101, 3, 5);
    let s = cureStart(round);
    expect(cureStepKind(s)).toBe("check");
    expect(cureHint(s)).toContain("看一看");
    round.steps.forEach((step, i) => {
      const res = curePick(s, step.answer.name);
      s = res.state;
      expect(res.acted).toBe(true);
      expect(res.miss).toBe(false);
      expect(s.step).toBe(i + 1);
      expect(res.done).toBe(i === round.steps.length - 1);
    });
    expect(s.done).toBe(true);
    expect(s.picks).toEqual(round.steps.map((x) => x.answer.name));
  });

  it("挑岔了停在原地，「退一步」能撤回来重选", () => {
    const round = buildCureRound(202, 3, 5);
    let s = cureStart(round);
    const wrong = round.steps[0].options.find((o) => o.name !== round.steps[0].answer.name)!;
    const bad = curePick(s, wrong.name);
    expect(bad.miss).toBe(true);
    expect(bad.state.step).toBe(0);
    expect(bad.state.picks).toEqual([]);

    // 第 0 步没得退，什么都不发生
    expect(cureBack(s).acted).toBe(false);
    expect(cureBack(s).state.step).toBe(0);

    s = curePick(s, round.steps[0].answer.name).state;
    s = curePick(s, round.steps[1].answer.name).state;
    expect(s.step).toBe(2);
    const back = cureBack(s);
    expect(back.acted).toBe(true);
    expect(back.miss, "退一步不扣任何东西").toBe(false);
    expect(back.state.step).toBe(1);
    expect(back.state.picks).toEqual([round.steps[0].answer.name]);
    // 退回去之后照样能重新做完
    let redo = back.state;
    for (let i = 1; i < round.steps.length; i++) redo = curePick(redo, round.steps[i].answer.name).state;
    expect(redo.done).toBe(true);
  });

  it("护理单不提前泄题：没做到的一步只画点点", () => {
    const round = buildCureRound(303, 3, 5);
    const plan = curePlan(cureStart(round));
    expect(plan[0].state).toBe("now");
    expect(plan[0].text).not.toContain(round.steps[0].answer.name);
    for (const step of plan.slice(1)) {
      expect(step.state).toBe("todo");
      expect(step.text).toBe("· · ·");
    }
    const after = curePlan(curePick(cureStart(round), round.steps[0].answer.name).state);
    expect(after[0].state).toBe("done");
    expect(after[0].text).toContain(round.steps[0].answer.name);
  });

  it("症状与处置全表只有温和的日常照料，没有一个医疗动作", () => {
    const banned = ["打针", "针剂", "输液", "吃药", "喂药", "药片", "剂量", "药量", "流血", "出血", "伤口", "手术", "开刀", "缝针", "病危", "重病", "感染", "发炎", "去世", "死"];
    const words = [
      ...CURE_TOOLS.map((t) => t.name),
      ...SYMPTOMS.map((s) => s.name),
      ...SYMPTOMS.flatMap((s) => s.order),
      CURE_SAFETY_LINE
    ];
    for (const w of words) {
      for (const bad of banned) expect(w.includes(bad), `看病词表里出现了「${bad}」：${w}`).toBe(false);
      expect(w).not.toMatch(/[A-Za-z]/);
    }
    expect(CURE_TOOLS.filter((t) => t.kind === "check").length).toBeGreaterThanOrEqual(3);
    expect(CURE_TOOLS.filter((t) => t.kind === "care").length).toBeGreaterThanOrEqual(6);
  });

  it("每种小毛病都是先观察、最后交给兽医，并且每关都念一句安全提示", () => {
    const kindOf = new Map(CURE_TOOLS.map((t) => [t.name, t.kind]));
    for (const s of SYMPTOMS) {
      expect(kindOf.get(s.order[0]), `${s.name} 的第一步该是观察`).toBe("check");
      expect(s.order[s.order.length - 1]).toBe("带去看兽医");
      expect(s.order.filter((n) => kindOf.get(n) === "check")).toHaveLength(1);
    }
    expect(CURE_SAFETY_LINE).toContain("大人");
    expect(CURE_SAFETY_LINE).toContain("兽医");
    // 舞台上确实把这句话挂出来了
    expect(readSource("arena.ts")).toContain("CURE_SAFETY_LINE");
  });
});

describe("萌猫小屋 1.2 · ⑦搭配：规则表写死，逐条讲理由", () => {
  it("规则表覆盖全部主题，加分标签与减分标签不打架", () => {
    expect(Object.keys(STYLE_RULES).sort()).toEqual([...STYLE_THEMES].sort());
    for (const theme of STYLE_THEMES) {
      const rule = STYLE_RULES[theme];
      expect(rule.plus.length).toBeGreaterThanOrEqual(2);
      expect(rule.minus.length).toBeGreaterThanOrEqual(2);
      for (const tag of rule.plus) expect(rule.minus).not.toContain(tag);
    }
  });

  it("每一件的得分都能在规则表里查到出处，理由只引用它自己的标签", () => {
    let checked = 0;
    for (const entry of STYLE_WARDROBE) {
      for (const item of entry.items) {
        for (const theme of STYLE_THEMES) {
          const rule = STYLE_RULES[theme];
          const plus = item.tags.filter((t) => rule.plus.includes(t));
          const minus = item.tags.filter((t) => rule.minus.includes(t));
          const want = item.tags.length === 0 ? 1 : Math.max(-1, Math.min(2, plus.length - (minus.length > 0 ? 1 : 0)));
          const line = judgeStyleItem(item, theme);
          expect(line.delta, `${item.name} 配 ${theme}`).toBe(want);
          expect(line.name).toBe(item.name);
          expect(line.reason.length).toBeGreaterThan(4);
          for (const tag of item.tags) {
            if (plus.includes(tag) || minus.includes(tag)) expect(line.reason).toContain(tag);
          }
          expect(line.delta).toBeGreaterThanOrEqual(-1);
          expect(line.delta).toBeLessThanOrEqual(2);
          checked++;
        }
      }
    }
    expect(checked).toBe(STYLE_WARDROBE.length * 6 * STYLE_THEMES.length);
  });

  it("百搭款稳拿一分，减分最多只扣一次（不叠加惩罚）", () => {
    const neutral = STYLE_WARDROBE[0].items.find((i) => i.tags.length === 0)!;
    for (const theme of STYLE_THEMES) {
      expect(judgeStyleItem(neutral, theme).delta).toBe(1);
      expect(judgeStyleItem(neutral, theme).reason).toContain("百搭");
    }
    const beach = STYLE_WARDROBE[0].items.find((i) => i.theme === "夏日海边")!;
    expect(beach.tags.length).toBe(2);
    expect(judgeStyleItem(beach, "冬日雪天").delta).toBe(-1);
  });

  it("一整套的合计等于逐条相加，档位与规则表口径一致", () => {
    const picks = [
      STYLE_WARDROBE[0].items.find((i) => i.theme === "星空晚会")!,
      STYLE_WARDROBE[1].items.find((i) => i.theme === "星空晚会")!,
      STYLE_WARDROBE[2].items.find((i) => i.tags.length === 0)!
    ];
    const score = scoreOutfit(picks, "星空晚会");
    expect(score.lines).toHaveLength(3);
    expect(score.total).toBe(score.lines.reduce((s, l) => s + l.delta, 0));
    expect(score.max).toBe(picks.length * 2);
    expect(score.stars).toBe(styleGrade(Math.max(0, score.total), score.max).stars);
    expect(score.label).not.toMatch(/差|笨|失败|不合格/);
    // 搭配固定挑三件
    expect(STYLE_PICKS).toBe(3);
    expect(styleSlotCount(undefined)).toBe(3);
    expect(styleSlotCount(2)).toBe(3);
    expect(styleSlotCount(9)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 三、心情归零 = 躲纸箱，不是重来
// ---------------------------------------------------------------------------

describe("萌猫小屋 1.2 · 心情归零改造", () => {
  it("心情掉光只是躲进纸箱，状态里根本没有「失败」这条路", () => {
    let cat = createCat("团团", 2, 10);
    expect(cat.hiding).toBe(false);
    cat = catAfter(cat, "miss");
    expect(cat.mood).toBe(0);
    expect(cat.hiding).toBe(true);
    expect(cat.hideCount).toBe(1);
    expect(faceOf(cat)).toBe("hiding");
    expect(Object.keys(cat)).not.toContain("failed");
    expect(catLine(cat)).toContain("纸箱");
    expect(catLine(cat)).not.toMatch(/失败|重来|结束/);
  });

  it("躲着的时候只认安抚，摸满三次自己出来、心情回一半", () => {
    let cat = catAfter(createCat("糯糯", 2, 10), "miss");
    expect(soothesLeft(cat)).toBe(SOOTHE_TO_RETURN);
    // 躲着时别的事都不生效
    for (const ev of ["done", "miss", "yawn", "peek"] as const) {
      const same = catAfter(cat, ev);
      expect(same.hiding).toBe(true);
      expect(same.soothed).toBe(0);
    }
    cat = catAfter(cat, "soothe");
    expect(cat.hiding).toBe(true);
    expect(soothesLeft(cat)).toBe(2);
    cat = catAfter(cat, "soothe");
    expect(cat.hiding).toBe(true);
    expect(soothesLeft(cat)).toBe(1);
    cat = catAfter(cat, "soothe");
    expect(cat.hiding).toBe(false);
    expect(cat.mood).toBe(5);
    expect(moodRatio(cat)).toBeCloseTo(0.5);
    expect(cat.face).toBe("curious");
    expect(soothesLeft(cat)).toBe(0);
  });

  it("躲过一次最高星降一档，躲第二次不再往下掉，永远保底一星", () => {
    const calm = createCat("团团", 8, 10);
    expect(starCap([calm])).toBe(3);
    let hid = catAfter(createCat("团团", 2, 10), "miss");
    expect(starCap([hid])).toBe(2);
    hid = catAfter(catAfter(catAfter(hid, "soothe"), "soothe"), "soothe");
    hid = catAfter(catAfter(catAfter(hid, "miss"), "miss"), "miss");
    expect(hid.hideCount).toBeGreaterThanOrEqual(2);
    expect(starCap([hid]), "躲第二次不叠加惩罚").toBe(2);
    expect(starCap([calm, hid])).toBe(2);
    expect(finalStars(0, 3)).toBe(3);
    expect(finalStars(0, 2)).toBe(2);
    expect(finalStars(9, 2)).toBe(1);
    expect(finalStars(99, 1)).toBe(1);
  });

  it("五种表情里没有难过与哭泣，做错最多只是委屈", () => {
    const faces = Object.keys(FACE_INFO).sort();
    expect(faces).toEqual(["curious", "happy", "hiding", "pouty", "sleepy"]);
    for (const info of Object.values(FACE_INFO)) {
      expect(info.label).not.toMatch(/难过|哭|伤心|生病|失败/);
    }
    const cat = catAfter(createCat("煤球", 10, 10), "miss");
    expect(["curious", "pouty"]).toContain(cat.face);
    expect(catAfter(cat, "pet").purring).toBe(true);
    expect(catLine(catAfter(cat, "pet"))).toContain("呼噜");
  });

  it("没有心情条的关（前 99 关）永远不会躲纸箱", () => {
    let cat = createCat("团团");
    expect(cat.moodMax).toBe(0);
    for (let i = 0; i < 20; i++) cat = catAfter(cat, "miss");
    expect(cat.hiding).toBe(false);
    expect(cat.hideCount).toBe(0);
    expect(moodRatio(cat)).toBe(1);
    expect(starCap([cat])).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 四、舞台：多猫目标锁定、躲纸箱的实际体验、destroy 归零
// ---------------------------------------------------------------------------

describe("萌猫小屋 1.2 · 舞台", () => {
  let dom: InstalledDom;
  let clock: FakeClock;
  let life: Life;
  let host: StubEl;
  let sounds: string[];

  beforeEach(() => {
    dom = installDom();
    clock = new FakeClock();
    life = newLife(clock);
    host = dom.doc.createElement("div");
    sounds = [];
  });

  afterEach(() => {
    life.destroy();
    dom.restore();
  });

  function makeArena(catCount: number, moodStart = 0, moodMax = 0): Arena {
    return new Arena(host as unknown as HTMLElement, {
      life,
      sfx: (name) => sounds.push(name),
      catCount,
      moodStart,
      moodMax,
      theme: 6,
      reduceMotion: true
    });
  }

  const feedSpec = (target: number) => ({
    task: "feed" as const,
    target,
    seed: 5,
    options: 4,
    playTaps: 3,
    notes: 3,
    cureSteps: 2,
    styleSlots: 3
  });

  it("双猫关：没选中目标猫时怎么点都不生效，而且不算失误", () => {
    const arena = makeArena(2, 9, 10);
    let done = 0;
    arena.selected = 0;
    arena.startTask(feedSpec(1), () => {
      done++;
    });
    const want = buildFeed(5, 4).want;

    findByLabel(host, want.name)!.fire("click");
    findByLabel(host, "饭碗")!.fire("click");

    expect(done).toBe(0);
    expect(arena.mistakes, "喂错猫不惩罚").toBe(0);
    expect(arena.cats[1].mood, "喂错猫不扣心情").toBe(9);
    expect(findOne(host, "ktc-msg")!.textContent).toContain("摇摇头");
    expect(findOne(host, "ktc-msg")!.textContent).toContain(arena.cats[1].name);
  });

  it("双猫关：点中目标猫会高亮并带名字，之后操作才落到它身上", () => {
    const arena = makeArena(2, 9, 10);
    let done = 0;
    arena.selected = 0;
    arena.startTask(feedSpec(1), () => {
      done++;
    });
    const want = buildFeed(5, 4).want;

    findByLabel(host, `选中${arena.cats[1].name}`)!.fire("click");
    expect(arena.selected).toBe(1);
    const cards = [0, 1].map((i) => findByLabel(host, `选中${arena.cats[i].name}`)!);
    expect(cards[1].classList.contains("ktc-cat-on")).toBe(true);
    expect(cards[0].classList.contains("ktc-cat-on")).toBe(false);
    expect(cards[1].getAttribute("aria-pressed")).toBe("true");
    expect(cards[1].textContent).toContain(arena.cats[1].name);

    findByLabel(host, want.name)!.fire("click");
    findByLabel(host, "饭碗")!.fire("click");
    clock.runTimers();
    expect(done).toBe(1);
    expect(arena.mistakes).toBe(0);
    expect(sounds).toContain("win");
  });

  it("喂错东西只算一次做岔，猫歪头，关卡照样往下走", () => {
    const arena = makeArena(1);
    let done = 0;
    arena.startTask(feedSpec(0), () => {
      done++;
    });
    const state = buildFeed(5, 4);
    const wrong = state.options.find((f) => f.name !== state.want.name)!;
    findByLabel(host, wrong.name)!.fire("click");
    findByLabel(host, "饭碗")!.fire("click");
    expect(arena.mistakes).toBe(1);
    expect(done).toBe(0);
    expect(arena.cats[0].face).not.toBe("hiding");

    findByLabel(host, state.want.name)!.fire("click");
    findByLabel(host, "饭碗")!.fire("click");
    clock.runTimers();
    expect(done).toBe(1);
  });

  it("心情掉光：舞台换成安抚按钮，摸三下猫出来接着照顾，最高星降一档", () => {
    const arena = makeArena(1, 2, 10);
    let done = 0;
    arena.startTask(feedSpec(0), () => {
      done++;
    });
    const state = buildFeed(5, 4);
    const wrong = state.options.find((f) => f.name !== state.want.name)!;
    findByLabel(host, wrong.name)!.fire("click");
    findByLabel(host, "饭碗")!.fire("click");

    expect(arena.cats[0].hiding).toBe(true);
    expect(arena.starCap()).toBe(2);
    expect(findOne(host, "ktc-bubble")!.textContent).toContain("纸箱");
    const soothe = findOne(host, "ktc-soft")!;
    expect(soothe.getAttribute("aria-label")).toContain("3 次");

    soothe.fire("click");
    expect(soothe.getAttribute("aria-label")).toContain("2 次");
    soothe.fire("click");
    expect(soothe.getAttribute("aria-label")).toContain("1 次");
    soothe.fire("click");

    expect(arena.cats[0].hiding).toBe(false);
    expect(arena.cats[0].mood).toBe(5);
    expect(findOne(host, "ktc-msg")!.textContent).not.toMatch(/失败|重来|结束/);
    // 任务回来了，还能把这一关做完
    findByLabel(host, state.want.name)!.fire("click");
    findByLabel(host, "饭碗")!.fire("click");
    clock.runTimers();
    expect(done).toBe(1);
    expect(finalStars(arena.mistakes, arena.starCap())).toBe(2);
  });

  it("destroy 之后：监听、计时器、动画帧一个不剩，舞台也从页面上摘掉了", () => {
    const arena = makeArena(2, 9, 10);
    const specs = [
      { ...feedSpec(0), task: "feed" as const },
      { ...feedSpec(0), task: "wash" as const, washCols: 6, washRows: 6 },
      { ...feedSpec(0), task: "sleep" as const },
      { ...feedSpec(0), task: "dress" as const },
      { ...feedSpec(0), task: "play" as const },
      { ...feedSpec(0), task: "cure" as const },
      { ...feedSpec(0), task: "style" as const }
    ];
    for (const spec of specs) arena.startTask(spec, () => {});
    expect(totalListeners(host)).toBeGreaterThan(5);
    expect(clock.alive).toBeGreaterThan(0);
    expect(host.children).toHaveLength(1);

    arena.destroy();
    life.destroy();

    expect(clock.alive, "还剩着 timer / rAF 没拆").toBe(0);
    expect(life.pending).toEqual({ timers: 0, loops: 0, frames: 0, listeners: 0 });
    expect(totalListeners(arena.root as unknown as StubEl), "还有监听没摘").toBe(0);
    expect(host.children, "舞台没从页面上摘掉").toHaveLength(0);
    // 拆完之后再喊一声也不会画出东西来
    arena.startTask(feedSpec(0), () => {});
    expect(totalListeners(arena.root as unknown as StubEl)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 五、小屋相册
// ---------------------------------------------------------------------------

describe("萌猫小屋 1.2 · 小屋相册", () => {
  it("正好 24 件：12 张照片 + 12 件家具，id 与名字都不重样", () => {
    expect(ALBUM_TOTAL).toBe(24);
    expect(ALBUM_PIECES).toHaveLength(24);
    expect(ALBUM_PIECES.filter((p) => p.kind === "photo")).toHaveLength(12);
    expect(ALBUM_PIECES.filter((p) => p.kind === "furniture")).toHaveLength(12);
    expect(new Set(ALBUM_PIECES.map((p) => p.id)).size).toBe(24);
    expect(new Set(ALBUM_PIECES.map((p) => p.name)).size).toBe(24);
    for (const p of ALBUM_PIECES) {
      expect(unlockCost(p)).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(6);
      expect(p.name).not.toMatch(/[A-Za-z]/);
      if (p.kind === "furniture") expect(HOME_SPOTS).toContain(p.spot);
      else expect(p.spot).toBeUndefined();
    }
  });

  it("通关掉落只从没拿到的里面挑：24 次不重样，收齐之后就没了", () => {
    const owned: string[] = [];
    for (let i = 0; i < ALBUM_TOTAL; i++) {
      const piece = nextDrop(owned, i * 3 + 1);
      expect(piece, `第 ${i + 1} 次掉落落空了`).not.toBeNull();
      expect(owned).not.toContain(piece!.id);
      owned.push(piece!.id);
    }
    expect(owned).toHaveLength(24);
    expect(nextDrop(owned, 77)).toBeNull();
    // 同一关重复通关拿到的是同一件（不是抽卡）
    expect(nextDrop([], 12)?.id).toBe(nextDrop([], 12)?.id);
  });

  it("仓库照样收得齐，进度写在自己的 key 上（yiduo-yixing. 前缀，和关卡进度分开）", () => {
    expect(ALBUM_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(ALBUM_KEY).not.toBe("yiduo-yixing.l99.kitty-care");
    const box = memoryStorage();
    const store = new AlbumStore(fakeWallet(0), box);
    for (let lv = 0; lv < 24; lv++) expect(store.dropForLevel(lv)).not.toBeNull();
    expect(store.count()).toBe(24);
    expect(store.dropForLevel(99)).toBeNull();
    expect(box.data.has(ALBUM_KEY)).toBe(true);
    // 换一个仓库读同一份存档，收藏还在
    const again = new AlbumStore(fakeWallet(0), box);
    expect(again.count()).toBe(24);
  });

  it("解锁只吃小星星，扣的正好是标价，星星不够就原样不动", () => {
    const wallet = fakeWallet(20);
    const store = new AlbumStore(wallet, memoryStorage());
    const cheap = ALBUM_PIECES[0];
    const pricey = [...ALBUM_PIECES].sort((a, b) => b.cost - a.cost)[0];

    const poor = store.buy(pricey.id);
    expect(poor.ok).toBe(false);
    expect(poor.reason).toBe("poor");
    expect(poor.spent).toBe(0);
    expect(wallet.calls, "买不起就一颗星星都别动").toEqual([]);

    const bought = store.buy(cheap.id);
    expect(bought.ok).toBe(true);
    expect(bought.spent).toBe(cheap.cost);
    expect(wallet.calls).toEqual([-cheap.cost]);
    expect(store.stars()).toBe(20 - cheap.cost);
    expect(store.has(cheap.id)).toBe(true);

    const twice = store.buy(cheap.id);
    expect(twice.ok).toBe(false);
    expect(twice.reason).toBe("owned");
    expect(wallet.calls).toEqual([-cheap.cost]);
    expect(store.buy("根本没这件").reason).toBe("unknown");
  });

  it("家具只能摆在它该待的位置，照片摆不上去，没拿到的也摆不了", () => {
    const store = new AlbumStore(fakeWallet(999), memoryStorage());
    const shelf = ALBUM_PIECES.find((p) => p.kind === "furniture" && p.spot === "wall")!;
    const photo = ALBUM_PIECES.find((p) => p.kind === "photo")!;
    expect(store.place(shelf.id, "wall"), "还没拿到就摆不了").toBe(false);
    store.buy(shelf.id);
    store.buy(photo.id);
    expect(store.place(shelf.id, "floor")).toBe(false);
    expect(store.place(photo.id, "wall")).toBe(false);
    expect(store.place(shelf.id, "wall")).toBe(true);
    expect(store.placedAt("wall")?.id).toBe(shelf.id);
    expect(store.clearSpot("wall")).toBe(true);
    expect(store.placedAt("wall")).toBeNull();
    expect(store.clearSpot("wall")).toBe(false);
  });

  it("坏存档整份降级，不会把游戏带崩", () => {
    expect(sanitizeAlbum(null)).toEqual({ unlocked: [], placed: {} });
    expect(sanitizeAlbum("这不是对象")).toEqual({ unlocked: [], placed: {} });
    expect(parseAlbum("{坏掉的 json")).toEqual({ unlocked: [], placed: {} });
    const dirty = sanitizeAlbum({
      unlocked: ["p-first-day", "p-first-day", "不存在的", 42],
      placed: { wall: "p-first-day", floor: "f-cushion", 天花板: "f-lamp" }
    });
    expect(dirty.unlocked).toEqual(["p-first-day"]);
    expect(dirty.placed).toEqual({});
    const round = parseAlbum(serializeAlbum({ unlocked: ["f-shelf"], placed: { wall: "f-shelf" } }));
    expect(round.unlocked).toEqual(["f-shelf"]);
    expect(round.placed.wall).toBe("f-shelf");
  });

  it("星星余额优先复用平台收藏册，加减星星仍然走平台钱包", async () => {
    const fallback = fakeWallet(6);
    const shared = await shareWalletWithCollection(fallback);
    expect(shared.shared, "收藏册已经在 game-1.2 里了，应该复用它那份余额").toBe(true);
    expect(typeof shared.wallet.getStars()).toBe("number");
    shared.wallet.addStars(-2);
    expect(fallback.calls).toEqual([-2]);
    // 相册没有改共用文件，只是动态 import 了它
    expect(readSource("album.ts")).toContain('await import("../../engine/collection")');
  });
});

// ---------------------------------------------------------------------------
// 六、照顾马拉松（无尽）
// ---------------------------------------------------------------------------

describe("萌猫小屋 1.2 · 照顾马拉松", () => {
  it("四条难度线都是单调的，而且各自有封顶", () => {
    let prev = endlessRound(1);
    expect(prev.timeSec).toBeGreaterThan(ENDLESS_MIN_SEC);
    for (let n = 2; n <= 80; n++) {
      const cur = endlessRound(n);
      expect(cur.timeSec, `第 ${n} 轮时限变长了`).toBeLessThanOrEqual(prev.timeSec);
      expect(cur.cats).toBeGreaterThanOrEqual(prev.cats);
      expect(cur.complexity).toBeGreaterThanOrEqual(prev.complexity);
      expect(cur.options).toBeGreaterThanOrEqual(prev.options);
      expect(cur.timeSec).toBeGreaterThanOrEqual(ENDLESS_MIN_SEC);
      expect(cur.cats).toBeLessThanOrEqual(ENDLESS_MAX_CATS);
      expect(cur.complexity).toBeLessThanOrEqual(5);
      prev = cur;
    }
    expect(endlessRound(80).timeSec).toBe(ENDLESS_MIN_SEC);
    expect(endlessRound(80).cats).toBe(ENDLESS_MAX_CATS);
    // 参数再离谱也从第 1 轮起算
    expect(endlessRound(0).index).toBe(1);
    expect(endlessRound(-9).index).toBe(1);
  });

  it("七种任务轮着上场，一圈之内谁都不落下", () => {
    const first = Array.from({ length: 7 }, (_, i) => endlessRound(i + 1).task);
    expect(new Set(first).size).toBe(7);
    expect(first).toEqual([...ENDLESS_ORDER]);
    expect(endlessRound(8).task).toBe(endlessRound(1).task);
  });

  it("复杂度翻成具体数字之后也只增不减，而且都在合理范围里", () => {
    let prev = endlessParams(endlessRound(1));
    for (let n = 2; n <= 60; n++) {
      const cur = endlessParams(endlessRound(n));
      expect(cur.playTaps).toBeGreaterThanOrEqual(prev.playTaps);
      expect(cur.washCells).toBeGreaterThanOrEqual(prev.washCells);
      expect(cur.notes).toBeGreaterThanOrEqual(prev.notes);
      expect(cur.cureSteps).toBeGreaterThanOrEqual(prev.cureSteps);
      expect(cur.styleSlots).toBeGreaterThanOrEqual(prev.styleSlots);
      expect(cur.cureSteps).toBeLessThanOrEqual(4);
      expect(cur.styleSlots).toBeLessThanOrEqual(4);
      prev = cur;
    }
  });

  it("超时不是失败：这一轮不计分，直接进下一件事", () => {
    const round = endlessRound(4);
    const out = endlessTimeout(round);
    expect(out.scored).toBe(false);
    expect(out.nextIndex).toBe(5);
    expect(out.note).not.toMatch(/失败|输|结束|游戏结束|重来/);
    expect(endlessScore(0)).toBe(0);
    expect(endlessScore(7)).toBe(7);
    expect(endlessScore(-3)).toBe(0);
    for (const line of [endlessLine(0, 0), endlessLine(3, 3), endlessLine(2, 9)]) {
      expect(line).not.toMatch(/失败|输了|不合格/);
    }
    expect(endlessLine(0, 0)).toContain("没有输赢");
  });

  it("成绩走 save.recordEndlessBest，只留最好的那一次", () => {
    expect(readSource("index.ts")).toContain('save.recordEndlessBest(meta.id');
    const before = save.getGameProgress("kitty-care").endlessBest;
    const top = before + 7;
    expect(save.recordEndlessBest("kitty-care", top)).toBe(top);
    expect(save.recordEndlessBest("kitty-care", top - 3)).toBe(top);
    expect(save.getGameProgress("kitty-care").endlessBest).toBe(top);
  });
});

// ---------------------------------------------------------------------------
// 七、平台接线
// ---------------------------------------------------------------------------

describe("萌猫小屋 1.2 · 平台接线", () => {
  it("?level=N 读得出来，读不到就是 null", () => {
    expect(parseLevelParam("?level=12")).toBe(12);
    expect(parseLevelParam("?from=home&level=7")).toBe(7);
    expect(parseLevelParam("#level=3")).toBe(3);
    expect(parseLevelParam("?levels=3")).toBeNull();
    expect(parseLevelParam("")).toBeNull();
    expect(parseLevelParam("?level=abc")).toBeNull();
  });

  it("initialLevel 越界会夹回来，没解锁的退到当前能玩的最远一关", () => {
    expect(resolveInitialLevel(12, 100, 188)).toBe(11);
    expect(resolveInitialLevel("8", 100, 188)).toBe(7);
    expect(resolveInitialLevel(999, 100, 188)).toBe(100);
    expect(resolveInitialLevel(0, 100, 188)).toBe(0);
    expect(resolveInitialLevel(50, 3, 188), "还没解锁就退到最远那一关").toBe(3);
    expect(resolveInitialLevel(undefined, 100)).toBeNull();
    expect(resolveInitialLevel("随便", 100)).toBeNull();
  });

  it("直开第 N 关＝替玩家在地图上点一下；锁着就安静停住", () => {
    const clicks: string[] = [];
    const make = (chapterLocked: boolean, nodeLocked: boolean): MapHostLike => {
      const tab: MapNodeLike = {
        classList: { contains: (t) => t === "l99-tab-lock" && chapterLocked },
        getAttribute: () => null,
        click: () => clicks.push("tab")
      };
      const node: MapNodeLike = {
        classList: { contains: (t) => t === "l99-node-lock" && nodeLocked },
        getAttribute: (n) => (n === "aria-label" ? "第 3 关 · 还没打过" : null),
        click: () => clicks.push("node")
      };
      return { querySelectorAll: (sel) => (sel.includes("l99-tab") ? [tab] : [node]) };
    };

    expect(openLevelOnMap(make(false, false), 2, 0)).toBe(true);
    expect(clicks).toEqual(["tab", "node"]);
    clicks.length = 0;
    expect(openLevelOnMap(make(true, false), 2, 0), "章节还锁着").toBe(false);
    expect(clicks).toEqual([]);
    expect(openLevelOnMap(make(false, true), 2, 0), "关卡还锁着").toBe(false);
    expect(openLevelOnMap(make(false, false), 40, 0), "地图上没这一关").toBe(false);
    expect(openLevelOnMap(make(false, false), 2, 9), "没有这一章").toBe(false);
  });

  it("prefers-reduced-motion 读得到就听它的，读不到就当没开", () => {
    const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
    const had = "matchMedia" in g;
    const before = g.matchMedia;
    try {
      delete g.matchMedia;
      expect(prefersReducedMotion()).toBe(false);
      g.matchMedia = () => ({ matches: true });
      expect(prefersReducedMotion()).toBe(true);
      g.matchMedia = () => {
        throw new Error("不支持");
      };
      expect(prefersReducedMotion()).toBe(false);
    } finally {
      if (had) g.matchMedia = before;
      else delete g.matchMedia;
    }
  });

  it("Life：登记的东西数得清，destroy 之后一个都不剩、回调也不再响", () => {
    const clock = new FakeClock();
    const life = newLife(clock);
    let fired = 0;
    const target = { types: [] as string[], addEventListener() {}, removeEventListener() {} };
    life.after(() => fired++, 100);
    life.every(() => fired++, 100);
    life.frame(() => fired++);
    life.on(target, "click", () => fired++);
    expect(life.pending).toEqual({ timers: 1, loops: 1, frames: 1, listeners: 1 });
    expect(clock.alive).toBe(3);

    life.destroy();
    expect(life.pending).toEqual({ timers: 0, loops: 0, frames: 0, listeners: 0 });
    expect(clock.alive).toBe(0);
    // 拆完之后再登记也不会有东西挂上去
    life.after(() => fired++, 10);
    life.every(() => fired++, 10);
    expect(life.pending.timers).toBe(0);
    expect(fired).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 八、meta / 攻略 / 前 99 关回归 / 红线词扫
// ---------------------------------------------------------------------------

describe("萌猫小屋 1.2 · meta 与攻略", () => {
  it("meta 和 CHAPTERS、模式矩阵对得上", () => {
    expect(meta.id).toBe("kitty-care");
    expect(meta.levels).toBe(totalSize(CHAPTERS));
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.category).toBe("casual");
    expect([...meta.modes]).toContain("campaign");
    expect([...meta.modes], "1.2 新增照顾马拉松").toContain("endless");
    expect([...meta.modes]).not.toContain("versus");
    expect(["mobile", "desktop", "both"]).toContain(meta.platform);
  });

  it("blurb 改成了和事实一致的那一句，遗留的「归 B 改」注释也删了", () => {
    expect(meta.blurb).toContain("188");
    expect(meta.blurb).toMatch(/十大主题|10 大主题/);
    expect(meta.blurb).toMatch(/马拉松|无尽/);
    expect(meta.blurb).toContain("相册");
    expect(meta.blurb).not.toContain("六大季节");
    expect(meta.blurb).not.toContain("99 关");
    const src = readSource("meta.ts");
    expect(src).not.toContain("归 B 改");
    expect(src).not.toContain("待 B 改");
  });

  it("攻略铺满 188 关、逐章讲新手感，而且不泄题", () => {
    expect(guide.gameId).toBe("kitty-care");
    expect(guide.entries.length).toBeGreaterThanOrEqual(10);
    expect(guide.general.length).toBeGreaterThanOrEqual(3);
    expect(guide.general.length).toBeLessThanOrEqual(6);
    const sorted = [...guide.entries].sort((a, b) => a.from - b.from);
    expect(sorted[0].from).toBe(1);
    expect(sorted[sorted.length - 1].to).toBe(188);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].from).toBe(sorted[i - 1].to + 1);
    const all = [...guide.general, ...guide.entries.flatMap((e) => e.tips)].join("\n");
    expect(all).toContain("纸箱");
    expect(all).toMatch(/选中/);
    expect(all).not.toMatch(/答案|正确选项/);
  });
});

describe("萌猫小屋 1.2 · 前 99 关一个字都没动", () => {
  it("前 99 关的 SHA-256 指纹与升级前一致", () => {
    // 基线取自 origin/game-1.2 的 levels.ts（升级前逐关快照），本步逐关比对过完全相同。
    const whole = createHash("sha256").update(JSON.stringify(LEVELS.slice(0, LEGACY_LEVELS))).digest("hex");
    expect(whole).toBe("0fe493c93b77a55f844fba1e5acd9f655719d61c60fe79abda8f029a06798a38");
    // 计划书 13.3 在动代码之前钉下来的那一串（逐关串行）
    const perLevel = createHash("sha256")
      .update(LEVELS.slice(0, LEGACY_LEVELS).map((lv, i) => `${i}|${JSON.stringify(lv)}`).join("\n"))
      .digest("hex");
    expect(perLevel).toBe("b49836f7a34fbca257effd6c9e3556da84ebd0496a7ef44c4b6e4ffe57acdaea");
  });

  it("前 99 关照旧不带任何新机制字段，也不出现新任务", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(Object.keys(lv).sort()).toEqual(["notes", "options", "playTaps", "tasks", "theme", "washSpots"]);
      expect(lv.tasks).not.toContain("cure");
      expect(lv.tasks).not.toContain("style");
      expect(lv.theme).toBeLessThan(6);
    }
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual([17, 17, 17, 16, 16, 16]);
    expect(CHAPTERS).toHaveLength(10);
  });
});

describe("萌猫小屋 1.2 · 红线词扫", () => {
  const BRANDS = [
    "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟", "拳皇", "街霸",
    "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "tetris", "贪吃蛇大作战", "球球大作战", "我的世界",
    "minecraft", "三国杀", "大富翁", "斗地主", "pac-man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼",
    "喜羊羊", "蛋仔", "原神", "王者荣耀", "汤姆猫", "加菲猫", "hello kitty", "凯蒂猫", "招财猫"
  ];
  const BABY_TALK = ["宝宝", "乖乖", "小笨蛋", "萌萌哒", "棒棒哒", "美美哒", "睡觉觉", "吃饭饭", "喝奶奶", "打针针"];
  /** 玩法代码里绝不能出现的东西（注释里解释红线不算） */
  const MONEY_AND_HARM = [
    "抽卡", "卡池", "内购", "充值", "广告", "钻石", "金币", "元宝", "付费", "礼包",
    "打针", "剂量", "药量", "流血", "出血", "手术", "开刀", "安乐死", "遗弃", "照顾失败", "游戏结束"
  ];

  it("本款全部源码（含注释）不沾任何商标与已有 IP 猫形象", () => {
    for (const file of SOURCE_FILES) {
      const low = readSource(file).toLowerCase();
      for (const word of BRANDS) {
        expect(low.includes(word.toLowerCase()), `${file} 里出现了「${word}」`).toBe(false);
      }
      for (const word of BABY_TALK) {
        expect(low.includes(word), `${file} 里出现了低幼措辞「${word}」`).toBe(false);
      }
    }
    // 猫是本作原创角色
    expect(readSource("levels.ts")).toContain("团团");
    expect(readSource("catArt.ts")).toContain("原创");
  });

  it("玩法代码里没有任何货币 / 抽卡 / 内购 / 广告，也没有伤害与失败结局", () => {
    for (const file of SOURCE_FILES) {
      const code = stripComments(readSource(file));
      for (const word of MONEY_AND_HARM) {
        expect(code.includes(word), `${file} 的代码里出现了「${word}」`).toBe(false);
      }
    }
    // 相册确实只花星星
    const album = stripComments(readSource("album.ts"));
    expect(album).toContain("星星");
    expect(album).toContain("addStars");
  });

  it("屏幕上的每一句话都不批评孩子，也不催命", () => {
    const lines = [
      ...ALBUM_PIECES.map((p) => p.blurb),
      CURE_SAFETY_LINE,
      catLine(createCat("团团", 1, 10)),
      catLine(catAfter(createCat("团团", 2, 10), "miss")),
      endlessLine(0, 0),
      endlessLine(5, 9),
      endlessTimeout(endlessRound(3)).note,
      chaseHint(buildPlay(3)),
      ...Object.values(FACE_INFO).map((f) => f.label)
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/笨|蠢|差劲|不行|失败|太慢了|快点/);
      expect(line.trim().length).toBeGreaterThan(0);
    }
  });
});
