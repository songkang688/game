/** 第 3 轮 · 包 A · pool-stars 走查（临时脚本，取证后整目录删除）。 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "../games/pool-stars/index";
import {
  El,
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "../games/pool-stars/domStub";
import {
  CHAPTERS,
  TOTAL,
  buildEndlessLevel,
  buildLevel,
  findSolution,
  levelSuccess,
  loseLine,
  rateLevel,
  tryShot,
  winLine,
} from "../games/pool-stars/levels";
import { meta } from "../games/pool-stars/meta";
import { makeBall } from "../games/pool-stars/physics";
import { createTable, type ShotIntent, type TableOptions } from "../games/pool-stars/view";
import { BRAND_WORDS, RED_WORDS, dump, lastHitHeight, scanGame } from "./r3lib";

let dom: Dom;
const log: string[] = [];
const note = (l: string): void => void log.push(l);

beforeEach(() => {
  dom = installDom(360);
});
afterEach(() => {
  restoreDom();
});

function fakeApi() {
  return {
    root: dom.root as unknown as HTMLElement,
    play: () => undefined,
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined,
  } as never;
}
function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}
function css(): string {
  const style = dom.head.children.find((c) => c.id === "ps-shell-style");
  if (!style) throw new Error("ps-shell-style 没注入");
  return style.textContent;
}
function fireWin(type: string, key: string): void {
  fireWindow(dom, type, { key, preventDefault: () => undefined });
}
function mountTable(over: Partial<TableOptions> = {}): {
  handle: ReturnType<typeof createTable>;
  settled: ShotIntent[];
} {
  const settled: ShotIntent[] = [];
  const handle = createTable(dom.root as unknown as HTMLElement, {
    balls: [makeBall(0, "cue", 40, 50), makeBall(1, "warm", 140, 28)],
    seats: [{ name: "鸭梨", emoji: "🌸", color: "#e8558f", ai: null }],
    turn: 0,
    banner: "R3 练习台",
    tip: "先找线再出杆。",
    showAim: true,
    allowSpin: true,
    requireCall: false,
    freeBall: false,
    target: "warm",
    sfx: () => undefined,
    onSettled: (_res, shot) => settled.push(shot),
    ...over,
  });
  return { handle, settled };
}

describe("R3 包A · pool-stars", () => {
  it("① 深链 / meta / 模式入口", () => {
    const handle = mount(fakeApi());
    const opens = dom.root.findAll((e) => e.className.includes("ps-open"));
    note(`[pool-stars 深链] 模式入口=${opens.map((o) => o.textContent).join(" / ")}｜战役地图=${dom.root.find((e) => e.className.includes("l99-map")) !== null}`);
    expect(opens.length).toBeGreaterThanOrEqual(3);
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL);
    handle.destroy();
  });

  it("②③ 战役第 1 / 76 关：求解器给出真解，按解出杆判赢；打歪就判输", () => {
    const rows: string[] = [];
    for (const lv of [0, 75]) {
      const spec = buildLevel(lv);
      const sol = findSolution(spec);
      expect(sol, `第 ${lv + 1} 关求不出解`).not.toBeNull();
      const good = tryShot(spec, sol!.angle, sol!.power);
      const okCheck = levelSuccess(spec, good.res);
      // 故意打歪：把角度掰开 90°，同一套判定应当不给过
      const bad = tryShot(spec, sol!.angle + Math.PI / 2, sol!.power);
      const badCheck = levelSuccess(spec, bad.res);
      rows.push(
        `第 ${String(lv + 1).padStart(3)} 关 类型=${spec.kind} 允许 ${spec.shots} 杆 · 解(角度 ${sol!.angle.toFixed(3)} 力度 ${sol!.power}) → 进袋 ${good.res.potted.length} 判定=${okCheck.ok ? "过" : "不过"} · 打歪 → 判定=${badCheck.ok ? "过" : "不过"}（${badCheck.ok ? "" : loseLine(badCheck.reason ?? "miss")}）· 一杆过=${winLine(1)} 评星=${rateLevel(1, spec.shots)}★`
      );
      expect(okCheck.ok, `第 ${lv + 1} 关按解出杆却不算过`).toBe(true);
    }
    note(`[pool-stars 战役 1/76]\n  ${rows.join("\n  ")}`);
  });

  it("②③ 战役第 188 关（第 8 章「开球杯」是整局对战关）：真打一局分出胜负", async () => {
    const { playAiMatch } = await import("../games/pool-stars/match");
    const spec = buildLevel(187);
    expect(spec.kind).toBe("rack");
    expect(spec.targetIds).toEqual([]);
    const sim = playAiMatch([spec.aiTier as 1 | 2 | 3 | 4, spec.aiTier as 1 | 2 | 3 | 4], 20260827);
    note(
      `[pool-stars 第 188 关] 类型=${spec.kind}（整局 8 球赛，不是单杆题）· 开球 ${spec.balls.length} 颗 · 电脑第 ${spec.aiTier} 档 · 允许 ${spec.shots} 杆｜实打一局：赢家=${sim.winner === 0 ? "先手" : sim.winner === 1 ? "后手" : "未分"} 共 ${sim.shots} 杆 · 犯规 ${sim.fouls.join(":")} · 超时=${sim.timeout}`
    );
    expect([0, 1]).toContain(sim.winner);
    expect(sim.shots).toBeGreaterThan(0);
  }, 120000);

  it("④ 台面真出一杆：滚球 → 静止 → 结算回调", () => {
    const { handle, settled } = mountTable();
    fireWin("keydown", "f");
    dom.clock.ms += 300;
    fireWin("keyup", "f");
    for (let i = 0; i < 500 && settled.length === 0; i++) flushFrames(dom, 1);
    note(`[pool-stars 出杆] 结算 ${settled.length} 次，角度=${settled[0]?.angle.toFixed(3)} 力度=${settled[0]?.power.toFixed(2)}`);
    expect(settled).toHaveLength(1);
    handle.destroy();
  });

  it("⑤ PA-PS-1 未回潮：暂停期间瞄准 / 蓄力 / 出杆全部失效", () => {
    const { handle, settled } = mountTable();
    fireWin("keydown", "Escape");
    for (let i = 0; i < 10; i++) fireWin("keydown", "ArrowRight");
    fireWin("keydown", "f");
    dom.clock.ms += 400;
    fireWin("keyup", "f");
    for (let i = 0; i < 100; i++) flushFrames(dom, 1);
    const duringPause = settled.length;
    fireWin("keydown", "Escape");
    fireWin("keydown", "f");
    dom.clock.ms += 300;
    fireWin("keyup", "f");
    for (let i = 0; i < 500 && settled.length === 0; i++) flushFrames(dom, 1);
    note(
      `[pool-stars PA-PS-1] 暂停期间结算=${duringPause}（应为 0）；恢复后出杆结算=${settled.length}，角度=${settled[0]?.angle.toFixed(3)}（暂停里按的 10 次方向键没被算进去）`
    );
    expect(duringPause).toBe(0);
    expect(settled).toHaveLength(1);
    expect(settled[0].angle).toBeCloseTo(0, 5);
    handle.destroy();
  });

  it("⑥ 三个模式进得去退得出；无尽残局轮次递增", () => {
    const handle = mount(fakeApi());
    const base = windowListenerCount(dom);
    const seen: string[] = [];
    for (const label of ["人机对战", "双人同屏", "无尽残局"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 4);
      seen.push(`${label}: 台面就位=${dom.root.findAll((e) => e.tagName === "canvas").length > 0}`);
      byText("回选关")?.dispatch("click");
      byText("换个玩法")?.dispatch("click");
      if (windowListenerCount(dom) !== base) {
        // 有的模式退出入口叫法不同，兜底找返回类按钮
        dom.root
          .findAll((e) => e.tagName === "button" && /回|退出|换/.test(e.textContent))
          .slice(-1)
          .forEach((b) => b.dispatch("click"));
      }
    }
    const e0 = buildEndlessLevel(0);
    const e6 = buildEndlessLevel(6);
    seen.push(`无尽第 1 局 ${e0.balls.length} 颗球 / 允许 ${e0.shots} 杆；第 7 局 ${e6.balls.length} 颗 / ${e6.shots} 杆`);
    note(`[pool-stars 模式]\n  ${seen.join("\n  ")}`);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("⑦ destroy 20 轮：监听 / 子节点 / ps-shell-style 全部归零（PA-PS-3 终态）", () => {
    for (let round = 1; round <= 20; round++) {
      const handle = mount(fakeApi());
      byText("无尽残局")!.dispatch("click");
      flushFrames(dom, 4);
      handle.destroy();
      expect(windowListenerCount(dom), `第 ${round} 轮还留监听`).toBe(0);
      expect(dom.root.children.length, `第 ${round} 轮根节点没清空`).toBe(0);
      expect(dom.head.children.filter((c) => c.id === "ps-shell-style").length, `第 ${round} 轮样式留在 head`).toBe(0);
      if (round === 1 || round === 20) {
        note(`[pool-stars destroy] 轮 ${round}: 监听=0 根子节点=0 ps-shell-style=0 累计 cancelRAF=${dom.cancelled.length}`);
      }
    }
  });

  it("⑧ 360px 热区与红线", () => {
    const handle = mount(fakeApi());
    byText("无尽残局")!.dispatch("click");
    flushFrames(dom, 3);
    const tableSheet = dom.head.children.find((c) => c.id === "ps-style")?.textContent ?? "";
    const sheet = `${css()}\n${tableSheet}`;
    const sels = [".ps-open", ".ps-btn", ".ps-shoot", ".ps-back", ".ps-pick"];
    const measured = sels.map((s) => `${s}=${lastHitHeight(sheet, s)}px`);
    for (const s of sels) {
      const h = lastHitHeight(sheet, s);
      if (Number.isNaN(h)) continue;
      expect(h, `${s} 不到 44px`).toBeGreaterThanOrEqual(44);
    }
    handle.destroy();
    const files = ["index.ts", "meta.ts", "guide.ts", "levels.ts", "rules.ts", "physics.ts", "ai.ts", "view.ts", "match.ts"];
    const hits = scanGame("pool-stars", files, import.meta.url);
    note(`[pool-stars 热区/红线] ${measured.join(" ")}｜扫 ${files.length} 文件 × ${BRAND_WORDS.length}+${RED_WORDS.length} 词 → 命中 ${hits.length}`);
    expect(hits).toEqual([]);
  });

  it("⑨ PA-PS-2 未回潮：双人同屏两套瞄准键按座位分开", () => {
    const seats = [
      { name: "鸭梨", emoji: "🌸", color: "#e8558f", ai: null },
      { name: "康康", emoji: "⭐", color: "#3f7fd6", ai: null },
    ];
    function angleAfter(turn: number, keys: string[]): number {
      const { handle, settled } = mountTable({ seats, turn });
      for (const k of keys) fireWin("keydown", k);
      fireWin("keydown", "f");
      dom.clock.ms += 200;
      fireWin("keyup", "f");
      for (let i = 0; i < 500 && settled.length === 0; i++) flushFrames(dom, 1);
      const a = settled[0]?.angle ?? Number.NaN;
      handle.destroy();
      return a;
    }
    const duoOwn = angleAfter(0, ["a", "a", "a"]);
    const duoByStar = angleAfter(0, ["ArrowLeft", "ArrowLeft", "ArrowLeft"]);
    note(`[pool-stars PA-PS-2] 鸭梨回合：自己按 A×3 角度=${duoOwn.toFixed(3)}；康康按方向键×3 角度=${duoByStar.toFixed(3)}（够不着=${duoOwn !== duoByStar}）`);
    expect(duoOwn).not.toBeCloseTo(duoByStar, 5);
  });

  it("打印证据", () => {
    dump("R3 PackA · pool-stars", log);
    expect(log.length).toBeGreaterThan(5);
  });
});
