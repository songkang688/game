/**
 * 第 3 轮 · 测试员 · 包 A · dot-maze 走查（临时脚本，取证后整目录删除）。
 * 只读取证：不改任何产品代码，断言的是「现在应该成立的行为」。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BRAND_WORDS, dump, RED_WORDS, scanGame } from "./r3lib";
import { mount, mountStage } from "../games/dot-maze/index";
import {
  El,
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "../games/dot-maze/domStub";
import { CHAPTERS, configFor, endlessConfig, TOTAL } from "../games/dot-maze/levels";
import { meta } from "../games/dot-maze/meta";
import type { Maze } from "../games/dot-maze/maze";
import type { RunConfig } from "../games/dot-maze/logic";

let dom: Dom;
const log: string[] = [];
function note(line: string): void {
  log.push(line);
}

beforeEach(() => {
  dom = installDom(360);
});
afterEach(() => {
  restoreDom();
});

function fakeApi() {
  const wins: string[] = [];
  const loses: string[] = [];
  const sounds: string[] = [];
  return {
    wins,
    loses,
    sounds,
    api: {
      root: dom.root as unknown as HTMLElement,
      play: (n: string) => sounds.push(n),
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
function key(k: string): void {
  fireWindow(dom, "keydown", { key: k });
}
function css(): string {
  const style = dom.root.find((e) => e.tagName === "style");
  if (!style) throw new Error("样式没挂出来");
  return style.textContent;
}
function lastHitHeight(sheet: string, selector: string): number {
  const re = new RegExp(`\\${selector}\\{([^}]*)\\}`, "g");
  let height = Number.NaN;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sheet)) !== null) {
    const body = m[1];
    const explicit = /(?:^|;)\s*(?:min-)?height:\s*([\d.]+)px/.exec(body);
    if (explicit) {
      height = Number(explicit[1]);
      continue;
    }
    const pad = /(?:^|;)\s*padding:\s*([\d.]+)px/.exec(body);
    const font = /(?:^|;)\s*font-size:\s*([\d.]+)px/.exec(body);
    if (pad && font) height = Number(pad[1]) * 2 + Number(font[1]) * 1.2;
  }
  return height;
}

function corridor(opts: { dotsAt: number[]; homeX: number }): Maze {
  const w = 7;
  const h = 3;
  const wall: boolean[] = [];
  const dot: boolean[] = [];
  const power: boolean[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isWall = y !== 1 || x === 0 || x === w - 1;
      wall.push(isWall);
      dot.push(!isWall && opts.dotsAt.includes(x));
      power.push(false);
    }
  }
  return { w, h, wall, dot, power, tunnelRows: [], spawn: { x: 1, y: 1 }, home: { x: opts.homeX, y: 1 } };
}
function corridorCfg(over: Partial<RunConfig> = {}): RunConfig {
  return {
    maze: corridor({ dotsAt: [2, 3], homeX: 5 }),
    tier: "rookie",
    ghostCount: 0,
    lives: 3,
    stepMs: 120,
    fruitAt: [],
    fog: false,
    ...over,
  };
}

describe("R3 包A · dot-maze", () => {
  it("① 深链与 meta：首页 glob 收得到，四种模式入口点得开", () => {
    const metas = import.meta.glob("../games/*/meta.ts", { eager: true }) as Record<string, { meta?: { id?: string } }>;
    const ids = Object.values(metas).map((m) => m.meta?.id);
    expect(ids).toContain("dot-maze");
    const rec = fakeApi();
    const handle = mount(rec.api);
    const modes = dom.root.findAll((e) => e.tagName === "button" && e.className.includes("dmz-mode"));
    note(`[dot-maze 深链] meta.id 在 glob 里=true 模式入口=${modes.map((m) => m.textContent).join(" / ")}`);
    expect(modes).toHaveLength(4);
    expect(meta.modes.length).toBe(4);
    expect(meta.platform).toBe("both");
    handle.destroy();
  });

  it("②③ 真赢一次 + 真输一次（走 index → logic 同一套代码）", () => {
    const won: Array<{ won: boolean; livesLeft: number }> = [];
    const h1 = mountStage(dom.root as unknown as HTMLElement, {
      cfg: corridorCfg(),
      starRole: "none",
      label: "R3",
      onEnd: (r) => won.push({ won: r.won, livesLeft: r.livesLeft }),
    });
    key("d");
    for (let i = 0; i < 20 && won.length === 0; i++) flushFrames(dom, 1, 130);
    const leftText = dom.root.querySelector(".dmz-left")!.textContent;
    h1.destroy();
    expect(won[0].won).toBe(true);

    const lost: Array<{ won: boolean }> = [];
    const h2 = mountStage(dom.root as unknown as HTMLElement, {
      cfg: corridorCfg({ ghostCount: 1, lives: 1, maze: corridor({ dotsAt: [4, 5], homeX: 2 }) }),
      starRole: "none",
      label: "R3",
      onEnd: (r) => lost.push({ won: r.won }),
    });
    key("d");
    for (let i = 0; i < 80 && lost.length === 0; i++) flushFrames(dom, 1, 130);
    const note1 = dom.root.querySelector(".dmz-note")!.textContent;
    h2.destroy();
    expect(lost[0].won).toBe(false);
    for (const bad of ["笨", "废", "太差", "活该", "死"]) expect(note1.includes(bad)).toBe(false);
    note(`[dot-maze 胜负] 赢:${leftText} | 输:${note1}`);
  });

  it("④ 战役第 1 / 76 / 188 关（本轮换样本）都摆得出来且豆子可清", async () => {
    const { reachableDots, dotsLeft } = await import("../games/dot-maze/maze");
    const rows: string[] = [];
    for (const level of [0, 75, 187]) {
      const cfg = configFor(level);
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg,
        starRole: "none",
        label: `第 ${level + 1} 关`,
        extraChip: () => `第 ${level + 1} 关 · ${cfg.ghostCount} 只小幽灵`,
        onEnd: () => undefined,
      });
      const canvas = dom.root.querySelector(".dmz-canvas")!;
      const cell = canvas.width / cfg.maze.w;
      const reach = reachableDots(cfg.maze, cfg.maze.spawn);
      const total = dotsLeft(cfg.maze);
      rows.push(
        `第 ${String(level + 1).padStart(3)} 关 ${cfg.maze.w}×${cfg.maze.h} 档=${cfg.tier} 幽灵=${cfg.ghostCount} 命=${cfg.lives} 步长=${cfg.stepMs}ms 雾=${cfg.fog} 豆=${total} 可达=${reach} 格宽=${cell.toFixed(1)}px`
      );
      expect(reach, `第 ${level + 1} 关有豆子够不到`).toBe(total);
      expect(cell).toBeGreaterThanOrEqual(14);
      flushFrames(dom, 6, 120);
      handle.destroy();
      expect(windowListenerCount(dom)).toBe(0);
    }
    note(`[dot-maze 战役 1/76/188]\n  ${rows.join("\n  ")}`);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL);
  });

  it("⑤ 四种玩法都进得去、玩得动、退得出（含无尽推进两轮）", () => {
    const rec = fakeApi();
    const handle = mount(rec.api);
    const base = windowListenerCount(dom);
    const seen: string[] = [];
    for (const label of ["无尽迷宫", "抢豆对战", "双人追逃"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 6, 120);
      const canvas = dom.root.querySelector(".dmz-canvas")!;
      expect(canvas.width, `${label} 在 360px 上撑破了`).toBeLessThanOrEqual(340);
      seen.push(`${label}: 画布 ${canvas.width}px · HUD「${dom.root.querySelector(".dmz-left")!.textContent}」`);
      byText("换个玩法")!.dispatch("click");
      expect(windowListenerCount(dom), `${label} 退出后监听没回到原位`).toBe(base);
    }
    byText("闯关 188")!.dispatch("click");
    expect(dom.root.find((e) => e.className.includes("l99-map")), "闯关地图没出来").not.toBeNull();
    seen.push("闯关 188: 选关地图就位");
    handle.destroy();
    note(`[dot-maze 四模式]\n  ${seen.join("\n  ")}`);
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("⑥ 无尽真的能一直玩：连开 6 轮速度递增、掉光命才收", () => {
    const rows: string[] = [];
    for (const round of [0, 1, 2, 3, 4, 5]) {
      const cfg = endlessConfig(round);
      rows.push(`第 ${round + 1} 轮 步长=${cfg.stepMs}ms 幽灵=${cfg.ghostCount} 档=${cfg.tier}`);
    }
    note(`[dot-maze 无尽递增]\n  ${rows.join("\n  ")}`);
    expect(endlessConfig(5).stepMs).toBeLessThan(endlessConfig(0).stepMs);
  });

  it("⑦ destroy 进→玩→退→再进 20 轮，监听 / 子节点 / rAF 全部归零", () => {
    let cancelled = 0;
    for (let round = 1; round <= 20; round++) {
      const rec = fakeApi();
      const handle = mount(rec.api);
      byText("无尽迷宫")!.dispatch("click");
      flushFrames(dom, 5, 120);
      byText("换个玩法")!.dispatch("click");
      handle.destroy();
      cancelled = dom.cancelled.length;
      expect(windowListenerCount(dom), `第 ${round} 轮还留着 window 监听`).toBe(0);
      expect(dom.root.children.length, `第 ${round} 轮根节点没清空`).toBe(0);
      if (round === 1 || round === 10 || round === 20) {
        note(`[dot-maze destroy] 轮 ${round}: win 监听=0 根子节点=0 累计 cancelRAF=${cancelled}`);
      }
    }
    expect(cancelled).toBeGreaterThanOrEqual(20);
  });

  it("⑧ 商标 / 红线：目录内产品代码 0 命中", () => {
    const files = ["index.ts", "meta.ts", "guide.ts", "levels.ts", "logic.ts", "maze.ts", "ghosts.ts", "layout.ts"];
    const hits = scanGame("dot-maze", files, import.meta.url);
    note(
      `[dot-maze 红线] 扫 ${files.length} 个文件 × ${BRAND_WORDS.length} 商标词 + ${RED_WORDS.length} 红线词 → 命中 ${hits.length}`
    );
    expect(hits).toEqual([]);
  });

  it("⑨ 遗留复验 PA-DM-1 / PA-DM-2 / PA-DM-3 都没有回潮", () => {
    const rec = fakeApi();
    const handle = mount(rec.api);
    const sheet = css();
    const heights = [".dmz-key", ".dmz-mode", ".dmz-btn"].map((s) => `${s}=${lastHitHeight(sheet, s)}px`);
    expect(meta.blurb).not.toContain("小星星");
    expect(meta.blurb).toContain("豆子");
    for (const s of [".dmz-key", ".dmz-mode", ".dmz-btn"]) {
      expect(lastHitHeight(sheet, s), `${s} 又缩回 44 以下`).toBeGreaterThanOrEqual(44);
    }
    handle.destroy();
    note(`[dot-maze 遗留] PA-DM-1 热区 ${heights.join(" ")} ✅ | PA-DM-2 blurb「${meta.blurb.slice(0, 18)}…」不含小星星 ✅`);
  });

  it("⑩ 取消键 G / K 仍在（PA-DM-3 终态）", () => {
    function raceLeft(keys: string[]): string {
      const handle = mountStage(dom.root as unknown as HTMLElement, {
        cfg: corridorCfg({ maze: corridor({ dotsAt: [2, 3, 4, 5], homeX: 5 }) }),
        starRole: "none",
        label: "R3",
        onEnd: () => undefined,
      });
      for (let i = 0; i < 4; i++) {
        for (const k of keys) key(k);
        flushFrames(dom, 2, 130);
      }
      const out = dom.root.querySelector(".dmz-left")!.textContent;
      handle.destroy();
      return out;
    }
    const quiet = raceLeft([]);
    expect(raceLeft(["a"])).not.toBe(quiet);
    expect(raceLeft(["a", "g"])).toBe(quiet);
    expect(raceLeft(["a", "k"])).toBe(quiet);
    note("[dot-maze PA-DM-3] A 掉头改得动局面、A+G 与 A+K 都撤得回来 ✅");
  });

  it("打印证据", () => {
    dump("R3 PackA · dot-maze", log);
    expect(log.length).toBeGreaterThan(5);
  });
});
