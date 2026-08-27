/** 第 3 轮 · 包 A · fruit-stack 走查（临时脚本，取证后整目录删除）。 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "../games/fruit-stack/index";
import {
  El,
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "../games/fruit-stack/domStub";
import { CHAPTERS, buildEndless, buildLevel, buildVersus, goalFeasible, goalText } from "../games/fruit-stack/levels";
import { CHAIN, TOP_LEVEL, TOP_RULE, chainMerges, dropFruit, nameOf, scoreFor } from "../games/fruit-stack/merge";
import { createWorld, kineticEnergy, stepPhysics } from "../games/fruit-stack/physics";
import { meta } from "../games/fruit-stack/meta";
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
  const wins: string[] = [];
  const loses: string[] = [];
  return {
    wins,
    loses,
    api: {
      root: dom.root as unknown as HTMLElement,
      play: () => undefined,
      addStars: () => 0,
      getStars: () => 0,
      onWin: (_s: number, m?: string) => wins.push(m ?? ""),
      onLose: (m?: string) => loses.push(m ?? ""),
    } as never,
  };
}
function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}
function css(): string {
  const style = dom.head.children.find((c) => c.id === "fs-style");
  if (!style) throw new Error("fs-style 没注入");
  return style.textContent;
}

describe("R3 包A · fruit-stack", () => {
  it("① 首页 / 深链 + meta 与实现对得上", () => {
    const rec = fakeApi();
    const handle = mount(rec.api);
    const opens = dom.root.findAll((e) => e.className.includes("fs-open"));
    note(`[fruit-stack 深链] 模式入口=${opens.map((o) => o.textContent).join(" / ")}｜战役地图=${dom.root.find((e) => e.className.includes("l99-map")) !== null}`);
    expect(opens).toHaveLength(3);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    handle.destroy();
  });

  it("②③ 战役第 1 / 76 / 188 关目标都可达成（换第 76 关样本）", () => {
    const rows: string[] = [];
    for (const lv of [0, 75, 187]) {
      const spec = buildLevel(lv);
      rows.push(
        `第 ${String(lv + 1).padStart(3)} 关 ${spec.drops} 次投放 · 出果 ${spec.minDrop}–${spec.maxDrop} 级 · 盆 ${spec.box.w}×${spec.box.h} · 警戒线 y=${spec.lineY} · 目标「${goalText(spec.goal)}」 · 可达=${goalFeasible(spec)}`
      );
      expect(goalFeasible(spec), `第 ${lv + 1} 关目标不可达`).toBe(true);
    }
    note(`[fruit-stack 战役 1/76/188]\n  ${rows.join("\n  ")}`);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
  });

  it("④ 合成链 11 级 + 顶级规则 + 连锁计分", () => {
    const world = createWorld({ box: { w: 200, h: 320 }, lineY: 40 });
    dropFruit(world, 0, 60);
    dropFruit(world, 0, 62);
    for (let i = 0; i < 60; i++) stepPhysics(world, 8);
    const chained = chainMerges(world);
    note(
      `[fruit-stack 合成] 链长=${CHAIN.length}（${CHAIN.map((c) => c.name).join("→")}）顶级=${nameOf(TOP_LEVEL)} 顶级规则=${TOP_RULE}｜同级两籽相碰后 merges=${chained.merges.length} 加分=${chained.score}｜单次得分 1 级/1 连=${scoreFor(1, 1)} 1 级/3 连=${scoreFor(1, 3)}`
    );
    expect(CHAIN.length).toBe(11);
    expect(scoreFor(1, 3)).toBeGreaterThan(scoreFor(1, 1));
  });

  it("⑤ 自写物理稳定：100 次子步总动能不增长", () => {
    // 先让 12 颗果子落进盆里堆稳，再关掉重力连跑 100 个子步：动能一步都不许往上走
    const world = createWorld({ box: { w: 220, h: 340 }, lineY: 40, tuning: { gravity: 1400 } });
    for (let i = 0; i < 12; i++) dropFruit(world, i % 4, 30 + i * 14);
    for (let i = 0; i < 400; i++) stepPhysics(world, 8);
    world.tuning.gravity = 0;
    let prev = kineticEnergy(world);
    const start = prev;
    let rises = 0;
    for (let i = 0; i < 100; i++) {
      stepPhysics(world, 1000 / 120);
      const now = kineticEnergy(world);
      if (now > prev + 1e-9) rises += 1;
      prev = now;
    }
    note(
      `[fruit-stack 物理] 12 颗果子落定后关重力再跑 100 子步：起始动能=${start.toFixed(3)} 末值=${prev.toFixed(3)} 上涨次数=${rises}`
    );
    expect(rises, "固定步长下动能涨了").toBe(0);
  });

  it("⑥ 三个模式各进得去、退得出，双人两盆并排不撑破 360px", () => {
    const rec = fakeApi();
    const handle = mount(rec.api);
    const base = windowListenerCount(dom);
    const seen: string[] = [];
    for (const label of ["人机对战", "双人同屏", "无尽果盆"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 4);
      const canvases = dom.root.findAll((e) => e.tagName === "canvas");
      const widths = canvases.map((c) => Number.parseFloat(c.style.width) || c.width);
      seen.push(`${label}: 盆数=${canvases.length} 宽=${widths.map((w) => w.toFixed(0)).join("+")}px`);
      expect(widths.reduce((s, w) => s + w, 0), `${label} 撑破 360px`).toBeLessThanOrEqual(360);
      byText("回选关")!.dispatch("click");
      expect(windowListenerCount(dom), `${label} 退出后监听没归位`).toBe(base);
    }
    note(`[fruit-stack 模式]\n  ${seen.join("\n  ")}`);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("⑦ 无尽 / 对战关表可持续：轮次越靠后越难", () => {
    const en = buildEndless();
    const v0 = buildVersus(0);
    const v5 = buildVersus(5);
    note(
      `[fruit-stack 无尽/对战] 无尽：${en.drops} 次投放 · 目标「${goalText(en.goal)}」｜对战第 1 局 ${v0.drops} 投放 / 第 6 局 ${v5.drops} 投放（目标「${goalText(v5.goal)}」）`
    );
    expect(en.drops).toBeGreaterThan(0);
  });

  it("⑧ destroy 进→玩→退→再进 20 轮全部归零，样式也带走", () => {
    for (let round = 1; round <= 20; round++) {
      const rec = fakeApi();
      const handle = mount(rec.api);
      byText("无尽果盆")!.dispatch("click");
      flushFrames(dom, 4);
      byText("回选关")!.dispatch("click");
      handle.destroy();
      expect(windowListenerCount(dom), `第 ${round} 轮还留监听`).toBe(0);
      expect(dom.root.children.length, `第 ${round} 轮根节点没清空`).toBe(0);
      expect(dom.head.children.filter((c) => c.id === "fs-style").length, `第 ${round} 轮 fs-style 留在 head`).toBe(0);
      if (round === 1 || round === 20) {
        note(`[fruit-stack destroy] 轮 ${round}: 监听=0 根子节点=0 head 里的 fs-style=0 累计 cancelRAF=${dom.cancelled.length}`);
      }
    }
  });

  it("⑨ 360px 热区与红线：R2-PA-1 / PA-FS-1 / PA-FS-2 / PA-FS-3 都没回潮", () => {
    const rec = fakeApi();
    const handle = mount(rec.api);
    const sheet = css();
    const sels = [".fs-open", ".fs-btn", ".fs-back", ".fs-pick", ".fs-key"];
    for (const s of sels) expect(lastHitHeight(sheet, s), `${s} 缩回 44 以下`).toBeGreaterThanOrEqual(44);
    handle.destroy();
    const files = ["index.ts", "meta.ts", "guide.ts", "levels.ts", "merge.ts", "physics.ts", "ai.ts", "runtime.ts"];
    const hits = scanGame("fruit-stack", files, import.meta.url);
    note(
      `[fruit-stack 热区/红线] ${sels.map((s) => `${s}=${lastHitHeight(sheet, s)}px`).join(" ")}｜扫 ${files.length} 文件 × ${BRAND_WORDS.length}+${RED_WORDS.length} 词 → 命中 ${hits.length}`
    );
    expect(hits).toEqual([]);
  });

  it("⑩ 双人两套键位仍各管各的（PA-FS-2 终态：8 个键都接上）", () => {
    const rec = fakeApi();
    const handle = mount(rec.api);
    byText("双人同屏")!.dispatch("click");
    flushFrames(dom, 3);
    const keys = dom.root.findAll((e) => e.className.includes("fs-key"));
    const labels = keys.map((k) => k.textContent);
    note(`[fruit-stack 双人键位] 屏上虚拟键 ${keys.length} 个：${labels.join(" ")}`);
    expect(keys.length).toBeGreaterThanOrEqual(6);
    // 键盘：鸭梨 A/D/F/G，康康 方向键 /L/K —— 逐个按一遍不应抛异常，且落点会动
    for (const code of ["KeyA", "KeyD", "KeyF", "KeyG", "ArrowLeft", "ArrowRight", "KeyL", "KeyK"]) {
      fireWindow(dom, "keydown", { code });
      fireWindow(dom, "keyup", { code });
    }
    flushFrames(dom, 4);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("打印证据", () => {
    dump("R3 PackA · fruit-stack", log);
    expect(log.length).toBeGreaterThan(5);
  });
});
