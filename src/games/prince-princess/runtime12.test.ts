/**
 * 王子公主大冒险 1.2 的运行时用例:真的把游戏挂起来,按真键玩,数画布上画了什么。
 *
 * 纯函数那几份用例(`elements` / `abilities` / `checkpoints` / `teach` / `tower`)
 * 管不到的东西都在这儿:
 *
 *  - CSS 前缀确实全换成了 `pcp-`,一条别款的类名都没混进来;
 *  - 画面**真的照规范表画**:危险是三角 + 深红描边、可踩有亮顶边、奖励带发光圈、
 *    可推的箱子有一圈虚线 —— 不是只把规范表写进攻略里应付差事;
 *  - 教学关顶上挂练习小牌,开场 3 秒弹图形提示,一行不超过 12 个字;
 *  - 教学关**站着不动**一整分钟,一颗心都不掉,也不会弹出「就差一点点」;
 *  - HUD 上有小旗计数;单人有固定位置的换人键,Tab 也认;
 *  - 无尽城堡塔按层数记成绩;
 *  - 平台直达第 N 关 / `?level=` / Skip 走家长门;
 *  - `destroy` 之后 rAF、window 监听、DOM 节点**全部归零**。
 */
import { afterEach, describe, expect, it } from "vitest";

import { allText, findAll, findButton, findCtx, findOne, install, type FakeEl, type Harness } from "./domStub";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { TOTAL_LEVELS } from "../level99";
import { save } from "../../engine/save";
import { ELEMENT_SPECS } from "./elements";
import { TEACH_LINE_MAX, teachLevels } from "./teach";
import { buildLevel } from "./levels";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
  resetLevelExtras();
});

interface Mounted {
  destroy: () => void;
  openCampaignLevel: (n: number) => number;
}

async function mountGame(
  h: Harness,
  extra: Record<string, unknown> = {}
): Promise<{ game: Mounted; played: string[]; mod: typeof import("./index") }> {
  const mod = await import("./index");
  const played: string[] = [];
  const game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: (n: string) => void played.push(n),
    addStars: (n: number) => n,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
    ...extra,
  } as never) as unknown as Mounted;
  // 「一个人玩 / 两人一起」是整局记住的模块级偏好,不重置的话上一条用例会串到下一条
  findButton(h.root, "一个人玩")?.fire("click");
  played.length = 0;
  return { game, played, mod };
}

function chip(h: Harness, needle: string): string {
  for (const c of findAll(h.root, "pcp-chip")) {
    if (c.textContent.includes(needle)) return c.textContent;
  }
  return "";
}

/** 一路按住右键往前跑,顺手隔几帧跳一下 —— 只为把整关的东西都画出来 */
function runRight(h: Harness, frames: number): void {
  h.key("keydown", "ArrowRight");
  for (let i = 0; i < frames; i++) {
    if (i % 24 === 0) h.key("keydown", "ArrowUp");
    if (i % 24 === 6) h.key("keyup", "ArrowUp");
    h.flush(1, 33);
  }
  h.key("keyup", "ArrowRight");
}

/** 第一关带重箱子的交替关(1 基关号) */
function firstBlockLevel(): number {
  for (let i = 99; i < TOTAL_LEVELS; i++) {
    if (buildLevel(i).blocks.length > 0) return i + 1;
  }
  throw new Error("一关重箱子都没有,交替关没生效");
}

// ---------------------------------------------------------------------------
// 一、CSS 前缀
// ---------------------------------------------------------------------------

describe("样式前缀", () => {
  it("样式表里的类名一律 pcp- 打头,没有 1.1 的 pp- 残留", async () => {
    const mod = await import("./index");
    const names = [...mod.CSS.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(20);
    expect([...new Set(names.filter((n) => !n.startsWith("pcp-")))]).toEqual([]);
  });

  it("挂载之后 DOM 上的类名也都是 pcp- 打头的", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(2);
    h.flush(3, 16);
    const bad: string[] = [];
    for (const node of findAll(h.root, "pcp-wrap").concat([h.root])) void node;
    const walkAll = (el: FakeEl): void => {
      for (const cls of el.className.split(/\s+/).filter(Boolean)) {
        // 188 关框架自己的类名(l99-)不归本款管,只看本款自己挂的
        if (cls.startsWith("pcp-") || cls.startsWith("l99-")) continue;
        bad.push(cls);
      }
      for (const kid of el.children) walkAll(kid);
    };
    walkAll(h.root);
    expect([...new Set(bad)].filter((c) => c.startsWith("pp-"))).toEqual([]);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 二、照规范表画
// ---------------------------------------------------------------------------

describe("画面照关卡元素规范表来", () => {
  it("危险画成三角,而且用的就是规范表那支深红描边", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(120);
    runRight(h, 90);
    const ops = findCtx(h.root)!.ops;
    const spikes = ops.filter((o) => o.op === "stroke" && o.stroke === ELEMENT_SPECS.hazard.stroke);
    expect(spikes.length).toBeGreaterThan(0);
    // 三个拐点 = 一枚三角。规范表里只有危险是三角形
    expect(spikes.some((o) => o.points === 3)).toBe(true);
    game.destroy();
  });

  it("能站的东西顶上有一条亮边,别的东西没有", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(120);
    h.flush(5, 33);
    const ops = findCtx(h.root)!.ops;
    const light = ELEMENT_SPECS.stand.topLight!;
    expect(ops.some((o) => o.op === "fillRect" && o.fill === light)).toBe(true);
    // 亮边这个颜色不许被别的角色借用
    for (const role of ["hazard", "push", "reward", "exit", "checkpoint"] as const) {
      expect(ELEMENT_SPECS[role].fill).not.toBe(light);
      expect(ELEMENT_SPECS[role].stroke).not.toBe(light);
    }
    game.destroy();
  });

  it("只有奖励会发光:画布上那圈柔光用的是规范表的 glow", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(120);
    runRight(h, 60);
    const ops = findCtx(h.root)!.ops;
    expect(ops.some((o) => o.op === "arc" && o.fill === ELEMENT_SPECS.reward.glow)).toBe(true);
    expect(ops.some((o) => o.op === "fill" && o.fill === ELEMENT_SPECS.reward.fill && o.points === 4)).toBe(true);
    game.destroy();
  });

  it("检查点小旗、出口拱门都各用各的描边色,两两不撞", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(120);
    // 画笔先攥在手里:跑到头这一关就结算了,那时候画布节点已经摘掉,再找就找不着了
    const ctx = findCtx(h.root)!;
    runRight(h, 900);
    const strokes = new Set(ctx.ops.filter((o) => o.op === "stroke").map((o) => o.stroke));
    expect(strokes.has(ELEMENT_SPECS.checkpoint.stroke)).toBe(true);
    expect(strokes.has(ELEMENT_SPECS.exit.stroke)).toBe(true);
    // 六个角色的描边色两两不同,这才谈得上「看轮廓就认得出」
    const all = Object.values(ELEMENT_SPECS).map((s) => s.stroke);
    expect(new Set(all).size).toBe(all.length);
    game.destroy();
  });

  it("可推的重箱子有一圈「推我」虚线,只有它是虚的", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(firstBlockLevel());
    const ctx = findCtx(h.root)!;
    runRight(h, 600);
    const dashed = ctx.ops.filter((o) => o.op === "stroke" && o.dashed);
    expect(dashed.length).toBeGreaterThan(0);
    expect(dashed.every((o) => o.stroke === ELEMENT_SPECS.push.stroke)).toBe(true);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 三、教学关
// ---------------------------------------------------------------------------

describe("每章第 1 关是无风险练习关", () => {
  it("顶上挂着练习小牌,开场就弹图形提示,一行不超过 12 个字", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.flush(120, 33);
    expect(findOne(h.root, "pcp-chip-teach")!.textContent).toContain("练习关");
    const cue = findOne(h.root, "pcp-cue")!;
    expect(cue.classes.has("pcp-on")).toBe(true);
    const line = findOne(h.root, "pcp-cue-line")!.textContent;
    expect(line.length).toBeGreaterThan(0);
    expect(line.length).toBeLessThanOrEqual(TEACH_LINE_MAX);
    // 先给图再给字
    expect(findOne(h.root, "pcp-cue-icons")!.textContent.trim().length).toBeGreaterThan(0);
    game.destroy();
  });

  it("三秒过后提示自己收起来,不挡着人玩", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.flush(400, 33);
    expect(findOne(h.root, "pcp-cue")!.classes.has("pcp-on")).toBe(false);
    game.destroy();
  });

  it("两个人站着不动整整一分钟:一颗心都不掉,也不会弹「就差一点点」", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    // 两人模式没有托管 AI,两位就真的杵在原地 —— 这才是「站着不动」
    findButton(h.root, "两人一起")!.fire("click");
    game.openCampaignLevel(1);
    h.flush(6, 33);
    const before = chip(h, "❤️");
    expect(before).toContain("❤️");
    h.flush(1300, 50);
    expect(chip(h, "❤️")).toBe(before);
    expect(allText(h.root)).not.toContain("就差一点点");
    game.destroy();
  });

  it("七章的第 1 关都挂着练习小牌,章节第 2 关就没有", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    for (const lv of teachLevels()) {
      game.openCampaignLevel(lv + 1);
      h.flush(3, 16);
      expect(findAll(h.root, "pcp-chip-teach").length, `第 ${lv + 1} 关`).toBe(1);
    }
    game.openCampaignLevel(2);
    h.flush(3, 16);
    expect(findAll(h.root, "pcp-chip-teach").length).toBe(0);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 四、检查点与能力
// ---------------------------------------------------------------------------

describe("HUD 上的小旗与能力", () => {
  it("HUD 有小旗计数,而且一关至少两面", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(60);
    h.flush(4, 33);
    const flag = chip(h, ELEMENT_SPECS.checkpoint.icon);
    expect(flag).toMatch(/\d+\/\d+/);
    const total = Number(flag.split("/")[1]);
    expect(total).toBeGreaterThanOrEqual(2);
    game.destroy();
  });

  it("单人有一颗固定位置的换人键,按 Tab 也换得动,HUD 跟着写出当家能力", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(60);
    h.flush(4, 33);
    const swap = findOne(h.root, "pcp-key-swap")!;
    expect(swap.style.gridColumn).toBe("4");
    expect(swap.style.gridRow).toBe("3");
    const first = chip(h, "王子") || chip(h, "公主");
    expect(first).toMatch(/推重物|滑翔/);
    h.key("keydown", "Tab");
    h.flush(2, 33);
    const second = chip(h, "王子") || chip(h, "公主");
    expect(second).not.toBe(first);
    swap.fire("click");
    h.flush(2, 33);
    expect(chip(h, "王子") || chip(h, "公主")).toBe(first);
    game.destroy();
  });

  it("两个人一起玩的时候,两套键位的说明里各写着各自的专属能力", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    findButton(h.root, "两人一起")!.fire("click");
    game.openCampaignLevel(60);
    h.flush(3, 16);
    const names = findAll(h.root, "pcp-pad-name").map((n) => n.textContent);
    expect(names.length).toBe(2);
    expect(names[0]).toContain("推重物");
    expect(names[1]).toContain("滑翔");
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 五、无尽城堡塔
// ---------------------------------------------------------------------------

describe("无尽城堡塔", () => {
  it("按钮进得去,画布挂得出来,成绩牌按层数说话", async () => {
    const h = (harness = install());
    const { game, mod } = await mountGame(h);
    expect(mod.towerBestLabel(0)).toBe("🏰 还没爬过");
    expect(mod.towerBestLabel(7)).toContain("第 7 层");
    findButton(h.root, "无尽城堡塔")!.fire("click");
    h.flush(4, 33);
    expect(findAll(h.root, "pcp-cv").length).toBe(1);
    expect(allText(h.root)).toContain("第 1 层");
    game.destroy();
  });

  it("存过层数之后,模式条上的按钮直接写着爬到过第几层", async () => {
    const h = (harness = install());
    save.recordEndlessBest("prince-princess", 12);
    const { game } = await mountGame(h);
    expect(findButton(h.root, "无尽城堡塔")!.textContent).toContain("第 12 层");
    game.destroy();
  });

  it("从塔里回关卡,选关地图会重新露出来", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    findButton(h.root, "无尽城堡塔")!.fire("click");
    h.flush(3, 16);
    findButton(h.root, "回关卡")!.fire("click");
    h.flush(2, 16);
    expect(findAll(h.root, "pcp-cv").length).toBe(0);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 六、平台接线
// ---------------------------------------------------------------------------

describe("平台接线", () => {
  it("levelFromQuery 只认合法的 ?level=", async () => {
    const mod = await import("./index");
    expect(mod.levelFromQuery("?level=42")).toBe(42);
    expect(mod.levelFromQuery("?a=1&level=7")).toBe(7);
    expect(mod.levelFromQuery("?level=7.9")).toBe(7);
    expect(mod.levelFromQuery("?level=0")).toBeNull();
    expect(mod.levelFromQuery("?level=abc")).toBeNull();
    expect(mod.levelFromQuery("")).toBeNull();
    expect(mod.levelFromQuery(null)).toBeNull();
  });

  it("openCampaignLevel(n) 真的开在第 n 关,越界会被夹回来", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    expect(game.openCampaignLevel(150)).toBe(150);
    expect(allText(h.root)).toContain("第 150 关");
    expect(game.openCampaignLevel(9999)).toBe(TOTAL_LEVELS);
    expect(game.openCampaignLevel(-3)).toBe(1);
    // 再开一关不会叠出第二块画布
    expect(findAll(h.root, "pcp-cv").length).toBe(1);
    game.destroy();
  });

  it("地址栏带 ?level= 就直接开那一关;壳层给了 initialLevel 就听壳层的", async () => {
    const a = (harness = install({ search: "?level=33" }));
    const first = await mountGame(a);
    expect(allText(a.root)).toContain("第 33 关");
    first.game.destroy();
    a.restore();

    const b = (harness = install({ search: "?level=33" }));
    const second = await mountGame(b, { initialLevel: 188 });
    expect(allText(b.root)).toContain("第 188 关");
    second.game.destroy();
  });

  it("壳层没注册 requestSkip 就不挂跳关按钮;注册了才有,而且走的是家长门", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(5);
    expect(findButton(findOne(h.root, "pcp-direct")!, "跳过")).toBeNull();
    game.destroy();

    const asked: Array<[string, number]> = [];
    registerLevelExtras({
      requestSkip: async (id: string, level: number) => {
        asked.push([id, level]);
        return false;
      },
    });
    const h2 = (harness = install());
    const second = await mountGame(h2);
    second.game.openCampaignLevel(5);
    const btn = findButton(findOne(h2.root, "pcp-direct")!, "跳过");
    expect(btn).not.toBeNull();
    btn!.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    // 关号是 0 基的,和框架内部一致(家长弹窗自己 +1 再展示)
    expect(asked).toEqual([["prince-princess", 4]]);
    second.game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 七、减少动态
// ---------------------------------------------------------------------------

describe("prefers-reduced-motion", () => {
  it("家长关了动效,就不再飘小图标,但该画的还是照画", async () => {
    const h = (harness = install());
    (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: true });
    const { game, mod } = await mountGame(h);
    expect(mod.reducedMotion()).toBe(true);
    game.openCampaignLevel(120);
    runRight(h, 60);
    const ops = findCtx(h.root)!.ops;
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.some((o) => o.op === "stroke" && o.stroke === ELEMENT_SPECS.hazard.stroke)).toBe(true);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 八、手机 360px
// ---------------------------------------------------------------------------

describe("360px 竖屏", () => {
  it("每一颗虚拟键的热区都不小于 44px", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const { game, mod } = await mountGame(h);
    game.openCampaignLevel(60);
    expect(findAll(h.root, "pcp-key").length).toBeGreaterThanOrEqual(6);
    expect(mod.CSS).toContain("min-width:44px");
    expect(mod.CSS).toContain("min-height:44px");
    game.destroy();
  });

  it("关卡里的提示一行不超过 12 个字", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.flush(3, 16);
    expect(findOne(h.root, "pcp-cue-line")!.textContent.length).toBeLessThanOrEqual(TEACH_LINE_MAX);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 九、分级红线
// ---------------------------------------------------------------------------

describe("分级红线", () => {
  it("界面上没有死 / 输 / 失败这类字眼,也没有童话 IP 的官方角色名", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(120);
    runRight(h, 80);
    const text = allText(h.root);
    for (const bad of ["死", "血", "杀", "失败", "灭亡"]) expect(text).not.toContain(bad);
    for (const ip of ["白雪公主", "灰姑娘", "睡美人", "青蛙王子", "长发公主", "美人鱼"]) {
      expect(text).not.toContain(ip);
    }
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 十、destroy 归零
// ---------------------------------------------------------------------------

describe("destroy 归零", () => {
  it("卸载之后 rAF、window 监听、DOM 节点一样不剩", async () => {
    const h = (harness = install());
    const before = h.windowListeners();
    const { game } = await mountGame(h);
    game.openCampaignLevel(60);
    h.flush(3, 33);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(h.windowListeners()).toBeGreaterThan(before);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(h.root.children.length).toBe(0);
  });

  it("两套键位在 destroy 时一起卸干净,卸完再敲键盘也不会复活一帧", async () => {
    const h = (harness = install());
    const before = h.windowListeners();
    const { game } = await mountGame(h);
    findButton(h.root, "两人一起")!.fire("click");
    game.openCampaignLevel(60);
    h.flush(3, 33);
    game.destroy();
    expect(h.windowListeners()).toBe(before);
    h.key("keydown", "KeyD");
    h.key("keydown", "ArrowLeft");
    h.key("keydown", "Tab");
    h.fireWindow("blur");
    h.fireWindow("pointerup");
    h.flush(3, 33);
    expect(h.pendingFrames()).toBe(0);
  });

  it("进过城堡塔再 destroy,一样归零", async () => {
    const h = (harness = install());
    const before = h.windowListeners();
    const { game } = await mountGame(h);
    findButton(h.root, "无尽城堡塔")!.fire("click");
    h.flush(4, 33);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(h.root.children.length).toBe(0);
  });

  it("换一关会把上一关收干净,不会两个循环叠着空转", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(60);
    h.flush(2, 33);
    const frames = h.pendingFrames();
    const listeners = h.windowListeners();
    game.openCampaignLevel(61);
    h.flush(2, 33);
    expect(h.pendingFrames()).toBeLessThanOrEqual(frames);
    expect(h.windowListeners()).toBe(listeners);
    expect(findAll(h.root, "pcp-cv").length).toBe(1);
    game.destroy();
  });
});
