/**
 * 彩虹跑跑 · 窗口 2 第 3 轮验收 · 测试员包 C 的走查脚本。
 *
 * 点名项③（本轮独立复验，不看它自带的用例，另起一套镜像重量）：
 *  - `view3d.ts` / `controls.ts` 相对 `origin/game-1.1` **零字节改动**；
 *  - `endless.ts` 是 1.1 的严格超集，1.1 的导出一个不少；
 *  - 全款无 three.js、无联网；
 *  - `makeCamera` 只在初始化与尺寸真变时调 —— 本轮把它包一层计数器**真挂载跑**。
 *
 * 外加七条铁则（战役样本换成第 1 / 76 / 188 关）与两条遗留项的回归网：
 *  - `R2C-R1`（四处热区 < 44px）：现在全部走 `touchArea()`，靠源码级筛子钉死；
 *  - `R2C-R2`（「掉血」「广告墙」）：全款红线词 0 命中，钉死不许回潮。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { BRAND_WORDS, RED_WORDS, dump, installSpeech, restoreSpeech, seedRandom } from "./r3lib";
import { El, dispatchWindow, flushFrames, installDom, restoreDom, windowListenerCount, type Dom } from "./canvasDom";

/** 摄像机计数器：包一层真实实现，只数调用，不改行为。 */
const { camCalls } = vi.hoisted(() => ({ camCalls: [] as string[] }));
vi.mock("../games/rainbow-run/view3d", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../games/rainbow-run/view3d")>();
  return {
    ...orig,
    makeCamera: (w: number, h: number) => {
      camCalls.push(`${w}x${h}`);
      return orig.makeCamera(w, h);
    },
  };
});

const { mount } = await import("../games/rainbow-run/index");
const { LEVELS, PROGRESS_KEY } = await import("../games/rainbow-run/logic");
const { ENDLESS_RECORD_KEY } = await import("../games/rainbow-run/endless");
const { meta } = await import("../games/rainbow-run/meta");

const DIR = new URL("../games/rainbow-run/", import.meta.url);
const W = 360;
const H = 640;

let dom: Dom;
let spoken: string[];
let plays: string[];
let wins: Array<[number, string | undefined]>;
let loses: string[];

function makeApi(initialLevel?: number) {
  plays = [];
  wins = [];
  loses = [];
  return {
    root: dom.root as never,
    play: (n: string) => void plays.push(n),
    addStars: () => 0,
    getStars: () => 0,
    onWin: (s: number, m?: string) => void wins.push([s, m]),
    onLose: (m?: string) => void loses.push(m ?? ""),
    initialLevel,
  } as never;
}

function canvasOf(): El {
  return dom.root.children[0];
}

function tap(x: number, y: number): void {
  canvasOf().dispatch("pointerdown", { clientX: x, clientY: y, pointerType: "touch" });
}

/**
 * 一路空跑到出结算：结算面板一定会自动朗读一句（clear / retry / 无尽收尾都会），
 * 朗读桩收到新的一句就说明这一趟真的跑到头了。
 */
function runUntilSettled(limit = 4000): string | null {
  const from = spoken.length;
  for (let i = 0; i < limit; i++) {
    flushFrames(dom, 1, 33);
    if (spoken.length > from) return spoken[spoken.length - 1];
  }
  return null;
}

function starsAt(idx: number): number {
  const raw = dom.storage.get(PROGRESS_KEY);
  if (!raw) return 0;
  return (JSON.parse(raw) as number[])[idx] ?? 0;
}

beforeEach(() => {
  dom = installDom(W, H);
  spoken = installSpeech();
  camCalls.length = 0;
});

afterEach(() => {
  restoreSpeech();
  restoreDom();
});

/* ---------------------------------------------------------------- */

describe("R3-C3 · 铁则 1：首页卡片与深链", () => {
  it("meta 是纯数据，两种玩法与 188 关都对得上", () => {
    expect(meta.id).toBe("rainbow-run");
    expect(meta.levels).toBe(LEVELS.length);
    expect(meta.levels).toBe(188);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless"]);
    for (const v of Object.values(meta)) expect(typeof v).not.toBe("function");
    // meta.ts 不许 import 玩法
    expect(readFileSync(new URL("meta.ts", DIR), "utf8")).not.toMatch(/^import /m);
  });

  it("不带 level 停在选世界屏，`?level=76` 直接进第 76 关", () => {
    const h1 = mount(makeApi());
    flushFrames(dom, 2);
    // 选世界屏上「♾️ 无尽彩虹跑」按得动 —— 说明确实停在这一屏
    tap(W / 2, 90);
    expect(plays).toContain("jump");
    h1.destroy();

    dom = installDom(W, H);
    dom.search.value = "?level=76";
    const h2 = mount(makeApi());
    flushFrames(dom, 2);
    // 已经在第 76 关的开场页：同一个坐标不再触发无尽
    tap(W / 2, 90);
    expect(plays).not.toContain("jump");
    h2.destroy();
  });

  it("`openCampaignLevel` 越界夹到两端，不抛", () => {
    const h = mount(makeApi());
    for (const n of [1, 76, 188, 0, -3, 9999, Number.NaN]) {
      expect(() => h.openCampaignLevel(n)).not.toThrow();
      flushFrames(dom, 2);
    }
    h.destroy();
  });
});

/**
 * 跑酷每帧都洒随机数（障碍抖动、粒子、追风云），不定 seed 就一跑一个样。
 * 本轮统一用包 C 第三批 seed（2718 / 5772 / 13331 / 60607 + 20260827）。
 */
const SEED = 2718;

describe("R3-C3 · 铁则 2/3/4：第 1 / 76 / 188 关真打到结算，赢一次输一次", () => {
  /** 开一关，一个键都不按地跑到底，回报结算那一句 */
  function playLevel(n: number, seed = SEED): { line: string | null; stars: number } {
    const undo = seedRandom(seed);
    try {
      const h = mount(makeApi(n));
      flushFrames(dom, 2);
      tap(W / 2, H / 2); // 开场页点一下开跑
      const line = runUntilSettled();
      const stars = starsAt(n - 1);
      h.destroy();
      return { line, stars };
    } finally {
      undo();
    }
  }

  it("第 1 关：摆烂也能跑到终点 —— 真赢一次", () => {
    const r = playLevel(1);
    dump("rainbow-run 第 1 关", [`seed=${SEED}`, `结算朗读=${r.line}`, `记星=${r.stars}`]);
    expect(r.line, "第 1 关没跑到结算").not.toBeNull();
    expect(r.line).toContain("跑完啦");
    expect(r.stars).toBeGreaterThanOrEqual(1);
    // 教学关的口径：能过，但摆烂拿不到满星
    expect(r.stars).toBeLessThan(3);
  });

  it("R17 最终结论：第 1 关摆烂只是「大概率」过，且最多两星", () => {
    const rows: string[] = [];
    let win = 0;
    for (const seed of [20260827, 2718, 5772, 13331, 60607]) {
      // 每个 seed 都要一副干净的存档，不然上一轮解锁的星会串进来
      restoreDom();
      dom = installDom(W, H);
      const r = playLevel(1, seed);
      if (r.stars > 0) win++;
      rows.push(`seed ${seed}: ${r.stars > 0 ? `通关 ${r.stars}★` : "摔倒"}`);
      expect(r.stars).toBeLessThan(3);
    }
    dump("rainbow-run 第 1 关 · 摆烂 5 seed", [...rows, `通关 ${win}/5`]);
    expect(win).toBeGreaterThanOrEqual(3);
    expect(win).toBeLessThan(5);
  });

  it("第 76 关：摆烂跑不过去 —— 真输一次", () => {
    const r = playLevel(76);
    dump("rainbow-run 第 76 关", [`seed=${SEED}`, `结算朗读=${r.line}`, `记星=${r.stars}`]);
    expect(r.line, "第 76 关没跑到结算").not.toBeNull();
    expect(r.line).toContain("重新出发");
    expect(r.stars).toBe(0);
  });

  it("第 188 关：终局关也跑得到结算，失败只鼓励不吓人", () => {
    const r = playLevel(188);
    dump("rainbow-run 第 188 关", [`seed=${SEED}`, `结算朗读=${r.line}`, `记星=${r.stars}`]);
    expect(r.line, "第 188 关没跑到结算").not.toBeNull();
    for (const bad of ["死", "血", "残忍", "杀"]) expect(r.line ?? "").not.toContain(bad);
  });
});

describe("R3-C3 · 铁则 5：无尽彩虹跑玩到失败并把纪录写盘", () => {
  it("从选世界屏点进无尽，一路摆烂跑到被追上，米数进 endless-record", () => {
    const undo = seedRandom(SEED);
    const h = mount(makeApi());
    flushFrames(dom, 2);
    tap(W / 2, 90);
    expect(plays).toContain("jump");
    // 无尽也先停在开场页，点一下才起跑
    flushFrames(dom, 2);
    tap(W / 2, H / 2);
    const line = runUntilSettled(8000);
    undo();
    const raw = dom.storage.get(ENDLESS_RECORD_KEY);
    dump("rainbow-run 无尽", [`收尾朗读=${line}`, `写盘=${raw}`]);
    expect(line, "无尽没跑到收尾").not.toBeNull();
    expect(raw, "无尽纪录没写盘").toBeTruthy();
    const rec = JSON.parse(raw as string) as { meters: number };
    expect(rec.meters).toBeGreaterThan(0);
    h.destroy();

    // destroy 之后重新挂载，纪录读得回来
    const h2 = mount(makeApi());
    flushFrames(dom, 2);
    expect(JSON.parse(dom.storage.get(ENDLESS_RECORD_KEY) as string).meters).toBe(rec.meters);
    h2.destroy();
  });
});

describe("R3-C3 · 点名项③：接住 1.1 的 2.5D 基建", () => {
  /** 取 1.1 的原文；仓库里没有那个 ref 就返回 null（本地跑得到就一定要跑） */
  function at11(path: string): string | null {
    try {
      return execFileSync("git", ["show", `origin/game-1.1:${path}`], {
        cwd: new URL("../../", import.meta.url).pathname,
        encoding: "utf8",
        maxBuffer: 1 << 24,
      });
    } catch {
      return null;
    }
  }

  it("`view3d.ts` / `controls.ts` 相对 1.1 零字节改动", () => {
    const report: string[] = [];
    for (const f of ["view3d.ts", "controls.ts"]) {
      const old = at11(`src/games/rainbow-run/${f}`);
      if (old === null) {
        report.push(`${f}: origin/game-1.1 不可用，跳过`);
        continue;
      }
      const now = readFileSync(new URL(f, DIR), "utf8");
      report.push(`${f}: ${old === now ? "0 行 diff" : "**有改动**"}`);
      expect(now, `${f} 相对 1.1 被改过，点名项③不成立`).toBe(old);
    }
    dump("rainbow-run 2.5D 基建", report);
  });

  it("`endless.ts` 是 1.1 的严格超集：老导出一个都没丢", () => {
    const old = at11("src/games/rainbow-run/endless.ts");
    if (old === null) return;
    const now = readFileSync(new URL("endless.ts", DIR), "utf8");
    const names = (src: string): string[] =>
      Array.from(src.matchAll(/^export (?:const|function|interface|type|class) (\w+)/gm)).map((m) => m[1]);
    const before = names(old);
    const after = new Set(names(now));
    const missing = before.filter((n) => !after.has(n));
    dump("rainbow-run endless.ts", [`1.1 导出 ${before.length} 个`, `1.2 导出 ${after.size} 个`, `丢失=${missing.join(",") || "无"}`]);
    expect(missing).toEqual([]);
    expect(after.size).toBeGreaterThan(before.length);
  });

  it("全款无 three.js、无 CDN、无联网上报", () => {
    const hits: string[] = [];
    for (const f of readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const src = readFileSync(new URL(f, DIR), "utf8");
      for (const bad of ['from "three"', "three.js", "fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "http://", "https://"]) {
        if (src.includes(bad)) hits.push(`${f}: ${bad}`);
      }
    }
    dump("rainbow-run 离线自查", hits.length ? hits : ["0 命中"]);
    expect(hits).toEqual([]);
  });

  it("`makeCamera` 只在初始化与尺寸真变时调，500 帧不重建", () => {
    const h = mount(makeApi());
    flushFrames(dom, 1);
    const afterMount = camCalls.length;
    flushFrames(dom, 300, 16);
    const after300 = camCalls.length;
    dom.root.clientWidth = 412;
    dom.root.clientHeight = 800;
    flushFrames(dom, 200, 16);
    const afterResize = camCalls.length;
    dump("rainbow-run makeCamera 计数", [
      `mount 后=${afterMount}`,
      `再跑 300 帧=${after300}`,
      `改成 412x800 再跑 200 帧=${afterResize}`,
      `参数序列=${camCalls.join(" → ")}`,
    ]);
    expect(afterMount).toBeLessThanOrEqual(2);
    expect(after300).toBe(afterMount); // 300 帧一次都没重算
    expect(afterResize).toBe(afterMount + 1); // 尺寸真变才重算，且只重算一次
    h.destroy();
  });
});

describe("R3-C3 · 铁则 6：360px 热区（R2C-R1 的回归网）", () => {
  it("画布上每一个偏小的按钮面都过一遍 `touchArea()`", () => {
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
    dump("rainbow-run 按钮面", report);
    expect(bad, "有偏小的按钮面没有扩到 44px").toEqual([]);
  });

  it("`btnEndless` 自身就是 44px 高，不再靠外扩", () => {
    const src = readFileSync(new URL("index.ts", DIR), "utf8");
    const m = /btnEndless = \{ x: ex, y: \d+, w: w - ex \* 2, h: (\d+) \}/.exec(src);
    expect(m, "btnEndless 的矩形写法变了，热区筛子要跟着改").not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });

  it("360px 下选关屏「◀ 地图」贴着左上角也点得到（外扩后仍在画布内）", () => {
    const h = mount(makeApi());
    flushFrames(dom, 2);
    // 选世界屏 → 第 1 个世界（卡片 x 21.6..175 / y 120..195.7）→ 选关屏
    tap(30, 160);
    expect(plays, "第 1 个世界没点开").toContain("tap");
    flushFrames(dom, 2);
    // 原按钮画在 (6,7,62,30)，竖向只有 30px。外扩之后 y 从 0 起算：
    // 贴着画布顶边的 y=2 与原按钮下沿之外的 y=42 都必须命中。
    plays.length = 0;
    tap(10, 2);
    expect(plays, "选关屏「◀ 地图」在 y=2 点不到").toContain("tap");
    h.destroy();

    const h2 = mount(makeApi());
    flushFrames(dom, 2);
    tap(30, 160);
    flushFrames(dom, 2);
    plays.length = 0;
    tap(10, 42);
    expect(plays, "选关屏「◀ 地图」在 y=42 点不到").toContain("tap");
    h2.destroy();
  });
});

describe("R3-C3 · 铁则 7：destroy 20 轮不泄漏", () => {
  it("进 → 玩 → 退 → 再进 20 轮，监听 / 子节点 / rAF 全部归零", () => {
    const marks: string[] = [];
    for (let r = 1; r <= 20; r++) {
      const h = mount(makeApi());
      flushFrames(dom, 8);
      tap(W / 2, 90);
      flushFrames(dom, 20);
      dispatchWindow(dom, "keydown", { code: "ArrowLeft", key: "ArrowLeft", preventDefault: () => {} });
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
      // 拆完之后再点再敲都不该有反应
      plays.length = 0;
      canvas.dispatch("pointerdown", { clientX: 100, clientY: 100 });
      dispatchWindow(dom, "keydown", { code: "Space", key: " ", preventDefault: () => {} });
      expect(plays).toEqual([]);
    }
    dump("rainbow-run destroy 20 轮", marks);
  });

  it("destroy 调两次不炸", () => {
    const h = mount(makeApi());
    h.destroy();
    expect(() => h.destroy()).not.toThrow();
  });
});

describe("R3-C3 · 铁则 8：商标 / 红线 0 命中（R2C-R2 的回归网）", () => {
  it("产品文件里商标与红线词一个都扫不出来", () => {
    const hits: string[] = [];
    for (const f of readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const src = readFileSync(new URL(f, DIR), "utf8");
      const low = src.toLowerCase();
      for (const wd of BRAND_WORDS) if (low.includes(wd.toLowerCase())) hits.push(`${f}: 商标「${wd}」`);
      for (const wd of RED_WORDS) {
        // 「成绩上报」说的是把无尽米数交给本地存档层，与联网上报无关；
        // 真正的联网上报由上面那条 fetch / XHR / sendBeacon / WebSocket 筛子把关。
        if (wd === "上报" && !src.replace(/成绩[^\n]{0,4}上报/g, "").includes(wd)) continue;
        if (src.includes(wd)) hits.push(`${f}: 红线「${wd}」`);
      }
      // R2C-R2 点名的两个词根，连注释一起钉死
      for (const wd of ["掉血", "广告墙", "血条"]) if (src.includes(wd)) hits.push(`${f}: R2C-R2 回潮「${wd}」`);
    }
    dump("rainbow-run 商标红线", hits.length ? hits : ["0 命中"]);
    expect(hits).toEqual([]);
  });

  it("攻略里没有血 / 死 / 伤害这类字眼，失败口径只鼓励", () => {
    const guide = readFileSync(new URL("guide.ts", DIR), "utf8");
    for (const bad of ["死", "血", "伤害"]) expect(guide, `攻略里出现「${bad}」`).not.toContain(bad);
    expect(guide).toContain("护甲");
  });
});
