/** 第 3 轮 · 包 A · junqi-camp 走查（临时脚本，取证后整目录删除）。 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "../games/junqi-camp/index";
import {
  El,
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "../games/junqi-camp/domStub";
import {
  CHAPTERS,
  TOTAL,
  endlessPlan,
  levelHint,
  maxPliesOf,
  planFor,
  rateLevel,
  replaySolution,
  solveLevel,
} from "../games/junqi-camp/levels";
import { meta } from "../games/junqi-camp/meta";
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
function sheets(): string {
  const inRoot = dom.root.findAll((e) => e.tagName === "style").map((s) => s.textContent);
  const inHead = dom.head.children.filter((c) => c.tagName === "style").map((s) => s.textContent);
  return [...inRoot, ...inHead].join("\n");
}

describe("R3 包A · junqi-camp", () => {
  it("① 深链 / meta / 四个模式入口", () => {
    const handle = mount(fakeApi());
    const modes = dom.root.findAll((e) => e.tagName === "button" && e.className.includes("jq-mode"));
    note(`[junqi-camp 深链] 模式入口=${modes.map((m) => m.textContent).join(" / ")}`);
    expect(modes).toHaveLength(4);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL);
    handle.destroy();
  });

  it("②③ 战役第 1 / 76 / 188 关：搜索器给出真解，回放到底就是赢", () => {
    const rows: string[] = [];
    for (const lv of [0, 75, 187]) {
      const plan = planFor(lv);
      const sol = solveLevel(lv, 200000);
      expect(sol, `第 ${lv + 1} 关搜不到解`).not.toBeNull();
      const ok = replaySolution(lv, sol!);
      rows.push(
        `第 ${String(lv + 1).padStart(3)} 关 档=${plan.tier} 手数上限=${plan.budget}（内部 ${maxPliesOf(plan)} 步）· 解 ${sol!.length} 手 · 回放判赢=${ok} · 评星（用满一半手数）=${rateLevel(Math.ceil(plan.budget / 2), plan.budget)}★ · 提示「${levelHint(lv)}」`
      );
      expect(ok, `第 ${lv + 1} 关的解回放不成立`).toBe(true);
    }
    note(`[junqi-camp 战役 1/76/188]\n  ${rows.join("\n  ")}`);
  });

  it("④ 四种玩法都进得去、退得出", () => {
    const handle = mount(fakeApi());
    const base = windowListenerCount(dom);
    const seen: string[] = [];
    for (const label of ["人机对战", "无尽连胜", "双人同屏"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 5);
      seen.push(`${label}: 棋盘就位=${dom.root.find((e) => e.className.includes("jq-board")) !== null}`);
      byText("换个玩法")!.dispatch("click");
      expect(windowListenerCount(dom), `${label} 退出后监听没归位`).toBe(base);
    }
    byText("闯关 188")!.dispatch("click");
    seen.push(`闯关 188: 选关地图=${dom.root.find((e) => e.className.includes("l99-map")) !== null}`);
    note(`[junqi-camp 模式]\n  ${seen.join("\n  ")}`);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("⑤ 无尽连胜能一直打：档位随连胜爬升", () => {
    const rows = [0, 3, 6, 10, 15, 24].map((s) => {
      const p = endlessPlan(s);
      return `连胜 ${s}: 档=${p.tier} seed=${p.seed}`;
    });
    note(`[junqi-camp 无尽] ${rows.join("｜")}`);
    expect(endlessPlan(24).tier).not.toBe(endlessPlan(0).tier);
  });

  it("⑥ destroy 20 轮全部归零", () => {
    for (let round = 1; round <= 20; round++) {
      const handle = mount(fakeApi());
      byText("人机对战")!.dispatch("click");
      flushFrames(dom, 4);
      byText("换个玩法")!.dispatch("click");
      handle.destroy();
      expect(windowListenerCount(dom), `第 ${round} 轮还留监听`).toBe(0);
      expect(dom.root.children.length, `第 ${round} 轮根节点没清空`).toBe(0);
      if (round === 1 || round === 20) {
        note(`[junqi-camp destroy] 轮 ${round}: 监听=0 根子节点=0 累计 cancelRAF=${dom.cancelled.length}`);
      }
    }
  });

  it("⑦ 360px 热区 + 红线", () => {
    const handle = mount(fakeApi());
    byText("人机对战")!.dispatch("click");
    flushFrames(dom, 4);
    const sheet = sheets();
    // .jq-cell 是百分比定位的格子，真正的可点面是里面的 .jq-face（自带 44×44 下限）
    const sels = [".jq-mode", ".jq-pick", ".jq-btn", ".jq-face"];
    const measured: string[] = [];
    for (const s of sels) {
      const h = lastHitHeight(sheet, s);
      measured.push(`${s}=${Number.isNaN(h) ? "—" : `${h}px`}`);
      if (Number.isNaN(h)) continue;
      expect(h, `${s} 不到 44px`).toBeGreaterThanOrEqual(44);
    }
    handle.destroy();
    const files = ["index.ts", "meta.ts", "guide.ts", "levels.ts", "rules.ts", "board.ts", "ai.ts", "view.ts", "setup.ts"];
    const hits = scanGame("junqi-camp", files, import.meta.url);
    note(`[junqi-camp 热区/红线] ${measured.join(" ")}｜扫 ${files.length} 文件 × ${BRAND_WORDS.length}+${RED_WORDS.length} 词 → 命中 ${hits.length}`);
    expect(hits).toEqual([]);
  });

  it("⑧ PA-JQ-1 / PA-JQ-2 未回潮：双人同屏两套键各管各的光标", () => {
    const handle = mount(fakeApi());
    byText("双人同屏")!.dispatch("click");
    flushFrames(dom, 4);
    const cursorText = (): string =>
      dom.root
        .findAll((e) => e.className.includes("jq-cell") && e.className.includes("cur"))
        .map((e) => e.getAttribute("data-pos") ?? e.className)
        .join(",");
    const before = cursorText();
    for (const k of ["ArrowDown", "ArrowDown", "ArrowRight"]) fireWindow(dom, "keydown", { key: k });
    flushFrames(dom, 2);
    const afterStarKeys = cursorText();
    for (const k of ["s", "s", "d"]) fireWindow(dom, "keydown", { key: k });
    flushFrames(dom, 2);
    const afterDuoKeys = cursorText();
    note(
      `[junqi-camp PA-JQ-1/2] 开局光标=${before || "（无高亮）"}｜康康按方向键后=${afterStarKeys || "（无变化）"}｜鸭梨按 WASD 后=${afterDuoKeys || "（无变化）"}`
    );
    // 鸭梨回合里：康康的方向键动不了鸭梨的光标，鸭梨自己的 WASD 才动得了
    expect(afterStarKeys).toBe(before);
    expect(afterDuoKeys).not.toBe(before);
    handle.destroy();
  });

  it("⑨ PA-JQ-3 未回潮：暂停期间挪光标 / 确认 / 取消都不接", () => {
    const handle = mount(fakeApi());
    byText("人机对战")!.dispatch("click");
    flushFrames(dom, 4);
    const cursorText = (): string =>
      dom.root
        .findAll((e) => e.className.includes("jq-cell") && e.className.includes("cur"))
        .map((e) => e.getAttribute("data-pos") ?? e.className)
        .join(",");
    fireWindow(dom, "keydown", { key: "s" });
    flushFrames(dom, 2);
    const picked = cursorText();
    fireWindow(dom, "keydown", { key: "Escape" });
    flushFrames(dom, 2);
    for (const k of ["s", "d", "f", "g"]) fireWindow(dom, "keydown", { key: k });
    flushFrames(dom, 2);
    const duringPause = cursorText();
    fireWindow(dom, "keydown", { key: "Escape" });
    flushFrames(dom, 2);
    note(`[junqi-camp PA-JQ-3] 暂停前光标=${picked}｜暂停期间乱按后=${duringPause}（没被改动=${picked === duringPause}）`);
    expect(duringPause).toBe(picked);
    handle.destroy();
  });

  it("打印证据", () => {
    dump("R3 PackA · junqi-camp", log);
    expect(log.length).toBeGreaterThan(5);
  });
});
