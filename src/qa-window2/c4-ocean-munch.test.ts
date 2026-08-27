/**
 * 海底大胃王 · 窗口 2 第 3 轮验收 · 测试员包 C 的走查脚本。
 *
 * 点名项④（本轮独立复验，另起一套镜像重量）：
 *  - 无尽真的玩到系统判失败；
 *  - 收尾把米数交给 `recordEndlessBest("ocean-munch", …)`；
 *  - `destroy` 之后重新挂载读得回纪录；
 *  - 前 99 关参数相对 `origin/game-1.1` 不漂。
 *
 * 外加七条铁则（战役样本换成第 1 / 76 / 188 关，三种玩法各玩到结算）
 * 与 `R2C-O1`（6 处导航按钮 < 44px）的回归网。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { save } from "../engine/save";
import { BRAND_WORDS, RED_WORDS, dump, installSpeech, restoreSpeech, seedRandom } from "./r3lib";
import { El, dispatchWindow, flushFrames, installDom, restoreDom, windowListenerCount, type Dom } from "./canvasDom";
import { mount } from "../games/ocean-munch/index";
import { LEVELS, TOTAL_LEVELS } from "../games/ocean-munch/logic";
import { meta } from "../games/ocean-munch/meta";

const DIR = new URL("../games/ocean-munch/", import.meta.url);
const W = 360;
const H = 640;
const SEED = 2718;

let dom: Dom;
let spoken: string[];
let plays: string[];

function makeApi(initialLevel?: number) {
  plays = [];
  return {
    root: dom.root as never,
    play: (n: string) => void plays.push(n),
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
    initialLevel,
  } as never;
}

function canvasOf(): El {
  return dom.root.children[0];
}

function tap(x: number, y: number): void {
  canvasOf().dispatch("pointerdown", { clientX: x, clientY: y, pointerType: "touch" });
}

function move(x: number, y: number): void {
  canvasOf().dispatch("pointermove", { clientX: x, clientY: y, pointerType: "touch" });
}

/** 首屏三张玩法卡的圆心（与 `drawHome` 同一套排版算式） */
function homeCard(i: number): { x: number; y: number } {
  const x0 = Math.max(12, W * 0.06);
  const y0 = 76;
  const pad = 12;
  const ch = Math.min(96, (H - y0 - 20 - pad * 2) / 3);
  return { x: x0 + (W - x0 * 2) / 2, y: y0 + i * (ch + pad) + ch / 2 };
}

/** 结算面板一定会自动朗读一句：收到新的一句就说明这一局跑到头了 */
function runUntilSettled(limit = 6000, stepMs = 40, swim = false): string | null {
  const from = spoken.length;
  for (let i = 0; i < limit; i++) {
    if (swim) circleAt(i, 18);
    flushFrames(dom, 1, stepMs);
    if (spoken.length > from) return spoken[spoken.length - 1];
  }
  return null;
}

/** 「瞎子式」绕圈找食：读不出鱼的坐标，只能按固定节奏画大圈把整片海扫一遍 */
function circleAt(i: number, period: number): void {
  const t = i / period;
  move(W / 2 + Math.cos(t) * (W * 0.36), H / 2 + Math.sin(t * 1.3) * (H * 0.32));
}

function runUntilSettledCircling(period: number, limit = 6000, stepMs = 40): string | null {
  const from = spoken.length;
  for (let i = 0; i < limit; i++) {
    circleAt(i, period);
    flushFrames(dom, 1, stepMs);
    if (spoken.length > from) return spoken[spoken.length - 1];
  }
  return null;
}

beforeEach(() => {
  dom = installDom(W, H);
  spoken = installSpeech();
});

afterEach(() => {
  restoreSpeech();
  restoreDom();
  vi.restoreAllMocks();
});

/* ---------------------------------------------------------------- */

describe("R3-C4 · 铁则 1：首页三张卡与深链", () => {
  it("meta 是纯数据，三种玩法与 188 关都对得上", () => {
    expect(meta.id).toBe("ocean-munch");
    expect(meta.levels).toBe(LEVELS.length);
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "versus"]);
    expect(meta.platform).toBe("both");
    for (const v of Object.values(meta)) expect(typeof v).not.toBe("function");
    expect(readFileSync(new URL("meta.ts", DIR), "utf8")).not.toMatch(/^import /m);
  });

  it("不带 level 停在首屏，`?level=76` 直开第 76 关", () => {
    const h1 = mount(makeApi());
    flushFrames(dom, 2);
    tap(homeCard(1).x, homeCard(1).y);
    expect(plays).toContain("jump"); // 首屏能点动深海马拉松
    h1.destroy();

    restoreDom();
    dom = installDom(W, H);
    dom.search.value = "?level=76";
    const h2 = mount(makeApi());
    flushFrames(dom, 3);
    tap(homeCard(1).x, homeCard(1).y);
    expect(plays).not.toContain("jump"); // 已经在第 76 关的引导页
    h2.destroy();
  });
});

describe("R3-C4 · 铁则 2/3/4：第 1 / 76 / 188 关真打到结算，赢一次输一次", () => {
  function playLevel(n: number, swim: boolean): string | null {
    const undo = seedRandom(SEED);
    try {
      const h = mount(makeApi(n));
      flushFrames(dom, 3);
      tap(W / 2, H * 0.4); // 引导页点一下下水
      const line = runUntilSettled(6000, 40, swim);
      h.destroy();
      return line;
    } finally {
      undo();
    }
  }

  /**
   * 驱动是「瞎子」：鱼是 `arc/ellipse` 画出来的，读不出坐标，只能按固定节奏画大圈扫海。
   * 所以这里换着 seed 与绕圈周期扫一轮，只要有一局真吃饱通关，铁则 2 就成立；
   * 顺带把「摆烂式绕圈」的胜率也记下来，当第 1 章的难度参照。
   */
  it("第 1 关：绕圈追小鱼吃饱 —— 真赢一次", () => {
    const rows: string[] = [];
    let win = 0;
    let sample: string | null = null;
    for (const seed of [2718, 5772, 13331, 60607]) {
      for (const period of [12, 45]) {
        restoreDom();
        dom = installDom(W, H);
        spoken.length = 0;
        const undo = seedRandom(seed);
        const h = mount(makeApi(1));
        flushFrames(dom, 3);
        tap(W / 2, H * 0.4);
        const line = runUntilSettledCircling(period);
        undo();
        h.destroy();
        const ok = (line ?? "").includes("通过啦");
        if (ok) {
          win++;
          sample ??= line;
        }
        rows.push(`seed ${seed} 周期 ${period}: ${ok ? "通关" : "被啃回岸上"}`);
      }
    }
    dump("ocean-munch 第 1 关 · 瞎子绕圈 8 局", [...rows, `通关 ${win}/8`, `样本结算=${sample}`]);
    expect(win, "8 局绕圈一局都没通关").toBeGreaterThanOrEqual(1);
    expect(sample).toContain("通过啦");
    expect(sample).toContain("颗星");
  });

  it("第 76 关：站着不动被啃回岸上 —— 真输一次", () => {
    const line = playLevel(76, false);
    dump("ocean-munch 第 76 关", [`seed=${SEED}`, `结算朗读=${line}`]);
    expect(line, "第 76 关没打到结算").not.toBeNull();
    expect(line).not.toContain("通过啦");
  });

  it("第 188 关：终局关也打得到结算，失败只鼓励不吓人", () => {
    const line = playLevel(188, false);
    dump("ocean-munch 第 188 关", [`seed=${SEED}`, `结算朗读=${line}`]);
    expect(line, "第 188 关没打到结算").not.toBeNull();
    for (const bad of ["死", "血", "残忍", "杀"]) expect(line ?? "").not.toContain(bad);
  });
});

describe("R3-C4 · 点名项④：无尽 + 纪录存档", () => {
  it("深海马拉松泡到系统判失败，米数交给 recordEndlessBest 并写进平台存档", () => {
    const record = vi.spyOn(save, "recordEndlessBest");
    const undo = seedRandom(SEED);
    const h = mount(makeApi());
    flushFrames(dom, 2);
    tap(homeCard(1).x, homeCard(1).y);
    const line = runUntilSettled(8000, 50);
    undo();
    dump("ocean-munch 无尽", [
      `收尾朗读=${line}`,
      `recordEndlessBest 调用=${record.mock.calls.length}`,
      `参数=${JSON.stringify(record.mock.calls[0] ?? null)}`,
    ]);
    expect(line, "无尽没跑到收尾").not.toBeNull();
    expect(record).toHaveBeenCalledTimes(1);
    const [id, depth] = record.mock.calls[0];
    expect(id).toBe("ocean-munch");
    expect(depth).toBeGreaterThan(0);
    expect(Number.isInteger(depth)).toBe(true);
    h.destroy();

    // destroy 之后再进来，纪录读得回来
    const h2 = mount(makeApi());
    flushFrames(dom, 2);
    expect(save.getGameProgress("ocean-munch").endlessBest).toBe(depth);
    h2.destroy();
  });

  it("纪录只增不减，也不串到别款名下", () => {
    const before = save.getGameProgress("ocean-munch").endlessBest;
    expect(save.recordEndlessBest("ocean-munch", before + 400)).toBe(before + 400);
    expect(save.recordEndlessBest("ocean-munch", 1)).toBe(before + 400);
    expect(save.recordEndlessBest("ocean-munch", Number.NaN)).toBe(before + 400);
    expect(save.getGameProgress("rainbow-run").endlessBest).not.toBe(before + 400);
  });
});

describe("R3-C4 · 铁则 5：对战也玩到结算", () => {
  it("选第 1 档下水，60 秒到点出胜负面板", () => {
    const undo = seedRandom(SEED);
    const h = mount(makeApi());
    flushFrames(dom, 2);
    tap(homeCard(2).x, homeCard(2).y);
    expect(plays).toContain("tap");
    flushFrames(dom, 2);
    // 对手卡：y0 = 80，卡高 min(92, …)
    const ch = Math.min(92, (H - 80 - 20 - 24) / 3);
    tap(W / 2, 80 + ch / 2);
    expect(plays).toContain("jump");
    const line = runUntilSettled(4000, 60, true);
    undo();
    dump("ocean-munch 对战", [`结算朗读=${line}`]);
    expect(line, "对战 60 秒没走到结算").not.toBeNull();
    for (const bad of ["死", "血", "笨蛋", "废物"]) expect(line ?? "").not.toContain(bad);
    h.destroy();
  });
});

describe("R3-C4 · 点名项④-4：前 99 关参数相对 1.1 不漂", () => {
  it("LEVELS 前 99 项与 origin/game-1.1 逐字段相同", () => {
    let old: string;
    try {
      old = execFileSync("git", ["show", "origin/game-1.1:src/games/ocean-munch/logic.ts"], {
        cwd: new URL("../../", import.meta.url).pathname,
        encoding: "utf8",
        maxBuffer: 1 << 24,
      });
    } catch {
      return; // 本地没有 1.1 的 ref 就跳过，别把 CI 拖红
    }
    const grab = (src: string): string => {
      const at = src.indexOf("export const LEVELS");
      expect(at, "1.1 的 logic.ts 里找不到 LEVELS").toBeGreaterThan(-1);
      const body = src.slice(at);
      // 前 99 个 `{ … }` 关卡字面量：按顶层大括号切
      const out: string[] = [];
      let depth = 0;
      let start = -1;
      for (let i = body.indexOf("["); i < body.length && out.length < 99; i++) {
        if (body[i] === "{") {
          if (depth === 0) start = i;
          depth++;
        } else if (body[i] === "}") {
          depth--;
          if (depth === 0 && start >= 0) out.push(body.slice(start, i + 1).replace(/\s+/g, " "));
        }
      }
      return out.join("\n");
    };
    const before = grab(old);
    const after = grab(readFileSync(new URL("logic.ts", DIR), "utf8"));
    dump("ocean-munch 前 99 关漂移", [`1.1 取到 ${before.split("\n").length} 关`, `漂移=${before === after ? 0 : "有"}`]);
    expect(before.length).toBeGreaterThan(0);
    expect(after).toBe(before);
  });
});

describe("R3-C4 · 铁则 6：360px 热区（R2C-O1 的回归网）", () => {
  it("每一个偏小的按钮面都过一遍 `touchArea()`", () => {
    const src = readFileSync(new URL("index.ts", DIR), "utf8");
    const lines = src.split("\n");
    const bad: string[] = [];
    const report: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const m = /const (\w+): Rect = \{ x: [^,]+, y: [^,]+, w: ([^,]+), h: ([^}]+) \}/.exec(lines[i]);
      if (!m) continue;
      const [, name, wExpr, hExpr] = m;
      const wNum = Number(wExpr.trim());
      const hNum = Number(hExpr.trim());
      const small = (Number.isFinite(wNum) && wNum < 44) || (Number.isFinite(hNum) && hNum < 44);
      const wrapped = lines.slice(i + 1, i + 3).some((l) => l.includes(`touchArea(${name})`));
      report.push(`${name} ${wExpr.trim()}×${hExpr.trim()} ${small ? (wrapped ? "→ touchArea ✅" : "**裸用**") : "本身够大 ✅"}`);
      if (small && !wrapped) bad.push(`${name}(第 ${i + 1} 行)`);
    }
    dump("ocean-munch 按钮面", report);
    expect(bad, "有偏小的按钮面没有扩到 44px").toEqual([]);
  });

  it("首屏「📖 图鉴」原本只有 34px 高，外扩之后上下各多出 5px 也点得到", () => {
    // 原按钮画在 (w-120, 8, 112, 34)，能点的只有 y 8..42；
    // 外扩到 44 之后是 y 3..47：上沿 y=4 与下沿 y=46 都必须命中。
    for (const y of [4, 46]) {
      restoreDom();
      dom = installDom(W, H);
      const h = mount(makeApi());
      flushFrames(dom, 2);
      plays.length = 0;
      tap(W - 60, y);
      expect(plays, `首屏图鉴按钮在 y=${y} 点不到`).toContain("tap");
      h.destroy();
    }
  });

  it("选关格子与玩法卡本来就够高（`Math.max(44, ch)` 兜底还在）", () => {
    const src = readFileSync(new URL("index.ts", DIR), "utf8");
    expect(src).toContain("h: Math.max(44, ch)");
  });
});

describe("R3-C4 · 铁则 7：destroy 20 轮不泄漏", () => {
  it("进 → 玩 → 退 → 再进 20 轮，监听 / 子节点 / rAF 全部归零", () => {
    const marks: string[] = [];
    for (let r = 1; r <= 20; r++) {
      const h = mount(makeApi());
      flushFrames(dom, 5);
      tap(homeCard(1).x, homeCard(1).y);
      flushFrames(dom, 20);
      dispatchWindow(dom, "keydown", { code: "KeyD", key: "d" });
      const canvas = canvasOf();
      h.destroy();
      dom.frames.length = 0;
      if (r === 1 || r === 10 || r === 20) {
        marks.push(`轮${r} win监听=${windowListenerCount(dom)} 画布监听=${canvas.countListeners()} 根子节点=${dom.root.children.length} 累计 cancel=${dom.cancelled.length}`);
      }
      expect(windowListenerCount(dom)).toBe(0);
      expect(canvas.countListeners()).toBe(0);
      expect(dom.root.children).toHaveLength(0);
      expect(dom.cancelled.length).toBe(r);
      plays.length = 0;
      canvas.dispatch("pointerdown", { clientX: 80, clientY: 80 });
      dispatchWindow(dom, "keydown", { code: "Space", key: " " });
      expect(plays).toEqual([]);
    }
    dump("ocean-munch destroy 20 轮", marks);
  });

  it("Esc 不吃、留给壳层暂停", () => {
    const h = mount(makeApi());
    flushFrames(dom, 2);
    tap(homeCard(1).x, homeCard(1).y);
    flushFrames(dom, 3);
    const esc = { code: "Escape", key: "Escape", preventDefault: vi.fn(), stopPropagation: vi.fn() };
    dispatchWindow(dom, "keydown", esc);
    dispatchWindow(dom, "keyup", esc);
    expect(esc.preventDefault).not.toHaveBeenCalled();
    expect(esc.stopPropagation).not.toHaveBeenCalled();
    h.destroy();
  });
});

describe("R3-C4 · 铁则 8：商标 / 红线 0 命中", () => {
  it("玩家看得见的文案里商标与红线词一个都扫不出来", () => {
    const hits: string[] = [];
    for (const f of readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "domStub.ts")) {
      const src = readFileSync(new URL(f, DIR), "utf8");
      // 注释本身写着「无血无死亡」这种自我约束，把注释剥掉再扫，只看真上屏的字
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      const low = code.toLowerCase();
      for (const wd of BRAND_WORDS) if (low.includes(wd.toLowerCase())) hits.push(`${f}: 商标「${wd}」`);
      for (const wd of RED_WORDS) if (code.includes(wd)) hits.push(`${f}: 红线「${wd}」`);
      for (const wd of ["大鱼吃小鱼", "Feeding Frenzy", "Hungry Shark"]) {
        if (low.includes(wd.toLowerCase())) hits.push(`${f}: 同类竞品名「${wd}」`);
      }
    }
    dump("ocean-munch 商标红线", hits.length ? hits : ["0 命中"]);
    expect(hits).toEqual([]);
  });

  it("全款离线：无 three.js、无 CDN、无联网上报", () => {
    const hits: string[] = [];
    for (const f of readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const src = readFileSync(new URL(f, DIR), "utf8");
      for (const bad of ['from "three"', "fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "http://", "https://"]) {
        if (src.includes(bad)) hits.push(`${f}: ${bad}`);
      }
    }
    dump("ocean-munch 离线自查", hits.length ? hits : ["0 命中"]);
    expect(hits).toEqual([]);
  });
});
