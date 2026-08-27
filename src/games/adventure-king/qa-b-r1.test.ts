/**
 * 窗口4 · 档B · 第 1 轮验收 —— 冒险小王(adventure-king)。
 *
 * 剧本:首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 →
 * 无尽遗迹 / 无尽古堡 / 计时速通三种模式各玩到结算 → 360px 窄屏 → 硬约束自查。
 * 只增用例,不改既有用例。
 */
import { describe, expect, it } from "vitest";
import { loadGames } from "../../engine/loader";
import {
  Disposer,
  ROOM_TEMPLATES,
  buildCastleRoom,
  castleLine,
  cellAt,
  parseRoom,
  resetRoom,
  solveRoom,
  stepMove,
  templatePoolFor,
  type Dir,
} from "./explore";
import { TOTAL_LEVELS as CAMPAIGN_TOTAL } from "../level99";
import {
  LEVELS,
  artifactsGrounded,
  buildEndlessFloor,
  buildSpeedrunCourse,
  levelTraversable,
  type AdvLevel,
} from "./levels";
import { endlessFloor, levelStars, timeAttackStars } from "./logic";
import { meta } from "./meta";
import {
  globalListenerBalance,
  inlineCss,
  mountFunctionsReturnDestroy,
  narrowBreakpoints,
  overflowingRules,
  rafBalanced,
  readGameSources,
  respectsReducedMotion,
  saveKeysIn,
  scanAudioMisuse,
  scanExternalDeps,
  scanRatingWords,
  scanTrademarks,
} from "./qaAudit";
import { botPlay, createRun, emptyInput, stepRun } from "./sim";

const SOURCES = readGameSources("adventure-king");
const INDEX = SOURCES.find((s) => s.name === "index.ts")!;
const CSS = inlineCss(INDEX);

/** 摆烂策略:一路向右,不跳、不甩钩、不扔回旋镖。用来验「真的有失败分支」。 */
function blindRun(lv: AdvLevel, maxSec = 60): { outcome: string; hearts: number; hurts: number } {
  const s = createRun(lv);
  let t = 0;
  while (t < maxSec && s.outcome === "run") {
    stepRun(lv, s, { ...emptyInput(), right: true }, 1 / 60);
    t += 1 / 60;
  }
  return { outcome: s.outcome, hearts: s.hearts, hurts: s.hurts };
}

describe("档B R1 · 冒险小王 · 首页进入", () => {
  it("首页收得到这一款,卡片信息完整", () => {
    const card = loadGames().find((g) => g.meta.id === "adventure-king");
    expect(card, "首页 loadGames() 里找不到 adventure-king").toBeTruthy();
    expect(card!.meta.title).toBe("冒险小王");
    expect(card!.meta.category).toBe("action");
    expect(card!.meta.emoji.length).toBeGreaterThan(0);
    expect(card!.meta.blurb.length).toBeGreaterThan(10);
    expect(typeof card!.load).toBe("function");
  });

  it("meta.levels 与真实关卡表一致(188),不是拍脑袋写的", () => {
    expect(meta.levels).toBe(188);
    expect(LEVELS).toHaveLength(188);
    expect(CAMPAIGN_TOTAL).toBe(188);
  });

  it("meta.modes 声明的玩法在实现里都真的有", () => {
    expect([...meta.modes]).toEqual(["campaign", "endless"]);
    // campaign = 188 关战役;endless = 无尽遗迹 + 无尽古堡 + 计时速通
    expect(INDEX.text).toContain("function mountEndless");
    expect(INDEX.text).toContain("function mountCastle");
    expect(INDEX.text).toContain("function mountSpeedrun");
  });

  it("从首页点进来能拿到 mount(动态 chunk 可加载)", async () => {
    const mod = await import("./index");
    expect(typeof mod.mount).toBe("function");
    expect(mod.meta.id).toBe("adventure-king");
  });

  it("meta.ts 是纯数据,不 import 任何玩法代码", () => {
    const metaSrc = SOURCES.find((s) => s.name === "meta.ts")!.text;
    expect(metaSrc).not.toMatch(/^import\s/m);
  });
});

describe("档B R1 · 冒险小王 · 赢一次 + 输一次", () => {
  it("赢:第 1 关机器人捡齐三件神器、推开首领之门", () => {
    const r = botPlay(LEVELS[0]);
    expect(r.outcome).toBe("clear");
    expect(r.artifacts).toBe(3);
    expect(levelStars(r.artifacts, r.hurts)).toBe(3);
  });

  it("输:一路向右不跳会掉进坑里,心掉光就结算失败", () => {
    const r = blindRun(LEVELS[0]);
    expect(r.outcome).toBe("fail");
    expect(r.hearts).toBe(0);
    expect(r.hurts).toBeGreaterThanOrEqual(4);
  });

  it("输掉之后状态机封口:再推进也不会再冒事件", () => {
    const lv = LEVELS[0];
    const s = createRun(lv);
    while (s.outcome === "run") stepRun(lv, s, { ...emptyInput(), right: true }, 1 / 60);
    expect(s.outcome).toBe("fail");
    for (let i = 0; i < 60; i++) {
      expect(stepRun(lv, s, { ...emptyInput(), right: true }, 1 / 60)).toEqual([]);
    }
  });

  it("失败只掉心、只鼓励:全库文案里没有伤亡描写", () => {
    expect(scanRatingWords(SOURCES)).toEqual([]);
    // 掉坑的提示语必须是温和的
    expect(INDEX.text).not.toMatch(/你死了|game over|GAME OVER/);
  });
});

describe("档B R1 · 冒险小王 · 战役第 1 / 100 / 188 关", () => {
  const spots = [
    { level: 1, idx: 0 },
    { level: 100, idx: 99 },
    { level: 188, idx: 187 },
  ];

  for (const { level, idx } of spots) {
    it(`第 ${level} 关形状合法且机器人能通关`, () => {
      const lv = LEVELS[idx];
      expect(levelTraversable(lv), `第 ${level} 关有跨不过去的坑`).toBe(true);
      expect(artifactsGrounded(lv), `第 ${level} 关有神器悬空`).toBe(true);
      const r = botPlay(lv, 180);
      expect(r.outcome, `第 ${level} 关没打通:${JSON.stringify(r)}`).toBe("clear");
      expect(r.artifacts).toBe(3);
    });
  }

  it("第 1 / 100 / 188 关的走廊一关比一关长,难度不回头", () => {
    const widths = spots.map(({ idx }) => LEVELS[idx].width);
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBeGreaterThan(widths[1]);
  });

  it("第 188 关是压轴关:目标时间最宽松,但心不比第 1 关多", () => {
    expect(LEVELS[187].parSec).toBeGreaterThan(LEVELS[0].parSec);
    expect(LEVELS[187].hearts).toBeLessThanOrEqual(LEVELS[0].hearts);
  });
});

describe("档B R1 · 冒险小王 · 三种无尽玩法各玩到结算", () => {
  it("无尽遗迹:第 1 / 10 / 30 层都能打下去,层配置单调变难", () => {
    for (const floor of [1, 10, 30]) {
      const r = botPlay(buildEndlessFloor(floor), 180);
      expect(r.outcome, `第 ${floor} 层卡住了:${JSON.stringify(r)}`).toBe("clear");
    }
    const cfgs = [1, 10, 30].map(endlessFloor);
    expect(cfgs[1].platforms).toBeGreaterThanOrEqual(cfgs[0].platforms);
    expect(cfgs[2].platforms).toBeGreaterThanOrEqual(cfgs[1].platforms);
  });

  it("无尽古堡:随机拼出来的前 20 间房都走得通,踩到出口就结算", () => {
    for (let room = 1; room <= 20; room++) {
      const built = buildCastleRoom(room * 13, room);
      expect(solveRoom(built.state), `第 ${room} 间「${built.template.name}」无解`).toBe(true);
    }
  });

  it("无尽古堡:一间房从头走到出口会真的抛出 clear 事件", () => {
    // 手搓一间只有一条直路的房间,一路向右必到出口
    const tpl = {
      id: "qa-line",
      name: "验收直廊",
      emoji: "🧪",
      focus: "door" as const,
      rows: ["#####", "#@..E", "#####"],
    };
    let state = parseRoom(tpl);
    let cleared = false;
    for (let i = 0; i < 8 && !cleared; i++) {
      const res = stepMove(state, "right" as Dir);
      state = res.state;
      cleared = res.events.some((e) => e.kind === "clear");
    }
    expect(cleared).toBe(true);
  });

  it("无尽古堡:复位能把房间原样还原(不卡死)", () => {
    const tpl = ROOM_TEMPLATES[1];
    const fresh = parseRoom(tpl);
    let moved = parseRoom(tpl);
    for (const dir of ["right", "right", "down"] as Dir[]) moved = stepMove(moved, dir).state;
    const back = resetRoom(tpl);
    expect(back.px).toBe(fresh.px);
    expect(back.py).toBe(fresh.py);
    expect(cellAt(back, back.px, back.py)).toBe(cellAt(fresh, fresh.px, fresh.py));
  });

  it("计时速通:八条赛道都能跑完并拿到 1~3 星", () => {
    for (let ci = 0; ci < 8; ci++) {
      const course = buildSpeedrunCourse(ci);
      const r = botPlay(course, 180);
      expect(r.outcome, `第 ${ci + 1} 条赛道没跑完:${JSON.stringify(r)}`).toBe("clear");
      const stars = timeAttackStars(r.seconds, course.par);
      expect(stars).toBeGreaterThanOrEqual(1);
      expect(stars).toBeLessThanOrEqual(3);
    }
  });

  it("无尽古堡的结束语只鼓励,没有名次羞辱", () => {
    for (const [rooms, best] of [
      [0, 0],
      [3, 9],
      [12, 12],
    ]) {
      const line = castleLine(rooms, best);
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toMatch(/失败|输了|太差|笨/);
    }
  });

  it("模板池随层数变大但不超过模板库", () => {
    expect(templatePoolFor(1).length).toBeLessThanOrEqual(ROOM_TEMPLATES.length);
    expect(templatePoolFor(99).length).toBe(ROOM_TEMPLATES.length);
  });
});

describe("档B R1 · 冒险小王 · 360px 窄屏", () => {
  it("内联样式里没有会在 360px 撑破容器的固定宽度", () => {
    expect(overflowingRules(CSS)).toEqual([]);
  });

  it("有窄屏断点,也照顾了 prefers-reduced-motion", () => {
    expect(narrowBreakpoints(CSS).length).toBeGreaterThan(0);
    expect(respectsReducedMotion(CSS)).toBe(true);
  });

  it("探索层方向盘在 360px 放得下(3 列 56px + 间距 = 180px)", () => {
    expect(CSS).toContain("grid-template-columns:repeat(3,56px)");
    const pad = 56 * 3 + 6 * 2;
    expect(pad).toBeLessThan(360);
  });

  it("方向盘按钮热区够大(≥44px),小朋友按得准", () => {
    const m = /\.advk-pad2 button\{[^}]*min-height:(\d+)px/.exec(CSS);
    expect(m, "找不到 .advk-pad2 button 的 min-height").not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });

  it("房间网格用百分比宽 + max-width,不写死像素宽", () => {
    expect(CSS).toMatch(/\.advk-room\{[^}]*width:100%/);
    expect(CSS).toMatch(/\.advk-room\{[^}]*max-width:420px/);
  });
});

describe("档B R1 · 冒险小王 · 硬约束自查", () => {
  it("商标黑名单 0 命中", () => {
    expect(scanTrademarks(SOURCES)).toEqual([]);
  });

  it("不引入 three.js / CDN / Socket / 联网", () => {
    expect(scanExternalDeps(SOURCES)).toEqual([]);
  });

  it("音效只走 api.play(...),没有自建 AudioContext", () => {
    expect(scanAudioMisuse(SOURCES)).toEqual([]);
    expect(INDEX.text).toMatch(/api\.play\(/);
  });

  it("存档 key 冻结:只有速通纪录与贴纸图鉴两把,前缀都对", () => {
    expect(saveKeysIn(SOURCES)).toEqual([
      "yiduo-yixing.adventure-king.album.v1",
      "yiduo-yixing.adventure-king.speedrun.v1",
    ]);
  });

  it("destroy 巡检:全局监听加了都摘、rAF 有取消、每个 mountXxx 都还 destroy", () => {
    const balance = globalListenerBalance(INDEX);
    expect(balance.added.length).toBeGreaterThan(0);
    expect(balance.leaked, `这些全局监听没摘:${balance.leaked.join("/")}`).toEqual([]);
    expect(rafBalanced(INDEX)).toBe(true);
    expect(mountFunctionsReturnDestroy(INDEX)).toEqual([]);
  });

  it("Disposer:dispose 之后一件不剩,之后再登记的立刻就地收掉", () => {
    const bag = new Disposer();
    let n = 0;
    bag.add(() => n++);
    bag.add(() => n++);
    expect(bag.size).toBe(2);
    bag.dispose();
    expect(bag.size).toBe(0);
    expect(n).toBe(2);
    bag.add(() => n++);
    expect(n).toBe(3);
    expect(bag.size).toBe(0);
  });
});
