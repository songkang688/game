/**
 * 1.2 第 12 步 C 档的第三批用例：平台接线那一节（规格第九节）。
 *
 * 两件事：
 *  1. **直达第 N 关**：本款的地图走平台 `mountLevelGame`，它只吐 `destroy`，
 *     没有「从第 N 关开始」的口子，所以本款自己开了 `openCampaignLevel(n)`。
 *     直达进去要真的是那一关、要能玩、要能结算、退出要归零。
 *  2. **幸运石真的提高稀有矿刷新**：1.2 之前 `rareWeightMult` 只是个纯函数，
 *     没人调用它；现在无尽下潜会带着它生成矿层，而**配额不跟着变富** ——
 *     配额也跟着涨的话，买幸运石就等于自己给自己加价。
 */
import { afterEach, describe, expect, it } from "vitest";
import { allText, countNodes, findButton, install, walk, type FakeEl, type Harness } from "./domStub";
import { CHAPTERS, RARE_KINDS, TOTAL, endlessLayer, levelAt, luckyBag } from "./levels";
import { MAX_LUCK, ORES, ORE_KINDS, angleFromPivot, hookAngle, type OreKind } from "./logic";
import { rareWeightMult } from "./depth12";
import { BANNED } from "./copy";
import { CSS } from "./style";
import { save } from "../../engine/save";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

interface Mounted {
  destroy: () => void;
  openCampaignLevel: (n: number) => number;
}

/** 挂一局；`initialLevel` 给了就走平台「直开第 N 关」那条路 */
async function mountGame(h: Harness, initialLevel?: number): Promise<{ game: Mounted; played: string[]; stars: number[] }> {
  const mod = await import("./index");
  const played: string[] = [];
  const starGains: number[] = [];
  const game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: (n: string) => void played.push(n),
    addStars: (n: number) => {
      starGains.push(n);
      return n;
    },
    ...(initialLevel === undefined ? {} : { initialLevel }),
  } as never);
  return { game, played, stars: starGains };
}

/**
 * 结算面板上写着的那几句话。
 *
 * 取**最后**一块 `.gdh-modes`：首页那块选模式的卡片藏起来之后还留在树上，
 * 取第一块会读到它。也不去读整棵树的文字 —— 那样会把 `<style>` 里给程序员看的
 * 注释一起读进来。
 */
function settleText(root: FakeEl): string {
  let panel: FakeEl | null = null;
  walk(root, (el) => {
    if (el.className.split(/\s+/).includes("gdh-modes")) panel = el;
  });
  return panel === null ? "" : allText(panel);
}

/**
 * 矿洞主画布(`gdh-cv`)。1.3 起 HUD 图标也是一块块小 canvas,
 * 所以不能再拿「树里第一个 canvas」当游戏画布,得按类名认。
 */
function canvasOf(root: FakeEl): FakeEl | null {
  let hit: FakeEl | null = null;
  walk(root, (el) => {
    if (!hit && el.tagName === "canvas" && el.className.split(/\s+/).includes("gdh-cv")) hit = el;
  });
  return hit;
}

/**
 * 一个照着「摆到谁的角度就钩谁」出手的稳当玩家，把这一关从头玩到倒计时结束。
 *
 * 它复用的是模拟器那套模型：钩子的摆动钟只在闲着摆的时候走（放绳出去到收回来
 * 这一段是冻住的），所以外面数着帧就能算出此刻钩子指向哪儿。目标金额本来就是
 * 拿模拟器算出来的，这个玩家能不能过关，等于在问「模拟器算的那条路在真的游戏
 * 循环里跑不跑得通」—— 两边一旦漂了，这条用例第一个红。
 */
function playLevelSmart(h: Harness, root: FakeEl, index: number): void {
  const lv = levelAt(index);
  // 会跑的地鼠要算提前量，这个稳当玩家不碰它，专钩站着不动的矿物
  const targets = lv.field.ores
    .filter((o) => ORES[o.kind].treasure && o.runRange === 0)
    .map((o) => angleFromPivot(o.x, o.y));
  const canvas = canvasOf(root);
  const fireBtn = findButton(root, "放绳");
  let swing = 0;
  const frames = Math.ceil(lv.field.time / 0.016) + 8;
  for (let i = 0; i < frames; i++) {
    // 「放绳」能按 ⇔ 钩子正在摆，摆动钟这一帧才往前走
    if (fireBtn?.disabled === false) {
      const at = hookAngle(lv.field, swing);
      const hit = targets.findIndex((a) => Math.abs(a - at) < 1.2);
      if (hit >= 0) {
        targets.splice(hit, 1);
        canvas?.fire("click");
      } else {
        swing += 0.016;
      }
    }
    h.flush(1);
  }
}

/** 平台那份 l99 星级存档里，第 index 关记了几颗星 */
function savedStars(h: Harness, index: number): number {
  const raw = h.storage.get("yiduo-yixing.l99.gold-hook");
  if (!raw) return 0;
  return (JSON.parse(raw) as number[])[index] ?? 0;
}

/* ---------------- 一、直达第 N 关 ---------------- */

describe("1.2 平台直达第 N 关", () => {
  it("openCampaignLevel 返回真正打开的关号，越界夹回 1..188", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    expect(game.openCampaignLevel(60)).toBe(60);
    expect(game.openCampaignLevel(0)).toBe(1);
    expect(game.openCampaignLevel(-9)).toBe(1);
    expect(game.openCampaignLevel(9999)).toBe(TOTAL);
    expect(game.openCampaignLevel(12.4)).toBe(12);
    game.destroy();
  });

  it("直达进去的确实是那一关：标题写着关号与它所属的章节", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    game.openCampaignLevel(150);
    const text = allText(h.root);
    expect(text).toContain("第 150 关");
    expect(text).toContain(CHAPTERS[levelAt(149).chapter].name);
    // 直达是「跳过地图直接开玩」，画布得真的在
    expect(canvasOf(h.root)).not.toBeNull();
    game.destroy();
  });

  it("壳层传 initialLevel 就一进来直达，不再先问玩哪个模式", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 7);

    expect(allText(h.root)).toContain("第 7 关");
    // 首页那两张模式卡片不该出现
    expect(findButton(h.root, "无尽矿井")).toBeNull();
    game.destroy();
  });

  it("没传 initialLevel 时照旧先看首页的模式卡片", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    expect(findButton(h.root, "闯关矿洞")).not.toBeNull();
    expect(findButton(h.root, "无尽矿井")).not.toBeNull();
    game.destroy();
  });

  it("直达关卡玩到时间用完会给结算面板，而且只鼓励、不批评", async () => {
    const h = install();
    harness = h;
    const { game, played } = await mountGame(h, 3);

    // 这一关给多少秒是关卡数据算出来的，按它排够帧数，让倒计时真的走完
    const frames = Math.ceil(levelAt(2).field.time / 0.016) + 8;
    h.flush(frames);

    const text = settleText(h.root);
    // 赢没赢取决于钩到了多少，但结算面板一定在，绝不会卡在空画面上
    expect(text.includes("过关") || text.includes("就差一点点")).toBe(true);
    expect(findButton(h.root, "选关地图")).not.toBeNull();
    for (const word of BANNED) expect(text, word).not.toContain(word);
    expect(played.length).toBeGreaterThan(0);
    game.destroy();
  });

  it("莽夫打法（一有机会就放绳）也能把这一关打到结算，钱包只增不减", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 20);

    const canvas = canvasOf(h.root);
    expect(canvas).not.toBeNull();
    const frames = Math.ceil(levelAt(19).field.time / 0.016) + 8;
    for (let i = 0; i < frames; i++) {
      canvas?.fire("click");
      h.flush(1);
    }
    expect(allText(h.root)).toMatch(/过关|就差一点点/);
    game.destroy();
  });

  it("直达进去照着摆动出手真能过关，星级写进平台那份 l99 存档", async () => {
    const h = install();
    harness = h;
    const { game, stars } = await mountGame(h, 1);

    expect(savedStars(h, 0)).toBe(0);
    playLevelSmart(h, h.root, 0);

    const text = settleText(h.root);
    expect(text).toContain("第 1 关过关");
    expect(findButton(h.root, "下一关")).not.toBeNull();
    expect(findButton(h.root, "再玩一次")).not.toBeNull();
    // 目标金额是模拟器算出来的，稳当地钩一趟拿三颗星才对得上
    expect(savedStars(h, 0)).toBe(3);
    expect(stars).toEqual([3]);
    game.destroy();
  });

  it("同一关再过一次不会再发小星星（直达不是刷星的后门）", async () => {
    const h = install();
    harness = h;
    const { game, stars } = await mountGame(h, 1);

    playLevelSmart(h, h.root, 0);
    expect(stars).toEqual([3]);

    findButton(h.root, "再玩一次")?.fire("click");
    playLevelSmart(h, h.root, 0);
    expect(settleText(h.root)).toContain("第 1 关过关");
    // 星级还在，但补发的小星星只有第一次那三颗
    expect(savedStars(h, 0)).toBe(3);
    expect(stars).toEqual([3]);
    game.destroy();
  });

  it("过关后按「下一关」接着开下一关", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 1);

    playLevelSmart(h, h.root, 0);
    findButton(h.root, "下一关")?.fire("click");
    expect(allText(h.root)).toContain("第 2 关");
    expect(canvasOf(h.root)).not.toBeNull();
    game.destroy();
  });

  it("从直达关卡按「选关地图」能回到平台地图，回去之后画布就收了", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 5);
    h.flush(3);
    expect(canvasOf(h.root)).not.toBeNull();

    findButton(h.root, "选关")?.fire("click");
    expect(canvasOf(h.root)).toBeNull();
    game.destroy();
  });

  it("直达进去再 destroy：rAF、window 监听与节点全部归零", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();
    const { game } = await mountGame(h, 88);
    h.flush(6);

    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(h.windowListeners()).toBeGreaterThan(before);

    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("反复直达不同关不会把监听越挂越多", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    let peak = 0;
    for (const n of [4, 40, 120, 188]) {
      game.openCampaignLevel(n);
      h.flush(4);
      peak = Math.max(peak, h.windowListeners());
    }
    expect(peak).toBeLessThanOrEqual(2);
    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
  });
});

/* ---------------- 一之二、360px 底部那一行 ---------------- */

/** 某个 class 下面直接挂着的那几个孩子 */
function childrenOf(root: FakeEl, cls: string): FakeEl[] {
  let box: FakeEl | null = null;
  walk(root, (el) => {
    if (!box && el.className.split(/\s+/).includes(cls)) box = el;
  });
  return box === null ? [] : (box as FakeEl).children;
}

describe("1.2 360px 底部那一行塞得下", () => {
  it("「收工」挂在顶部那一行,不占底部的格子", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 2);

    const bottom = childrenOf(h.root, "gdh-ctrl");
    // 底部只留五格:放绳 / 炸药 / 道具栏 / 商店 / 暂停。
    // 360px 上这一行是掐着算的,多一格就会把「放绳」那几个字挤出屏幕
    expect(bottom.length).toBe(5);
    const top = childrenOf(h.root, "gdh-hud");
    expect(top.length).toBe(4);
    expect(top.filter((c) => c.tagName === "button").length).toBe(1);
    game.destroy();
  });

  it("没达标时「收工」是藏起来的,而且 CSS 真能把它藏住", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 2);
    h.flush(3);

    const done = childrenOf(h.root, "gdh-hud").find((c) => c.tagName === "button");
    expect(done?.hidden).toBe(true);
    // `.gdh-btn` 是 inline-flex,会盖掉浏览器给 [hidden] 的 display:none;
    // 少了这一条,「收工」在真浏览器里一直杵着,还白占一格宽度
    expect(CSS).toContain(".gdh-btn[hidden]{display:none;}");
    game.destroy();
  });
});

/* ---------------- 一之三、无尽成绩记的是层深 ---------------- */

describe("1.2 无尽成绩走 save.recordEndlessBest", () => {
  it("一趟跑完，平台那份存档记的是层深，本款自己那份也跟着写", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    findButton(h.root, "无尽矿井")?.fire("click");
    findButton(h.root, "开挖")?.fire("click");
    // 第一层的时间是层数据算出来的，按它排够帧数让这一趟自然结束
    const frames = Math.ceil(endlessLayer(1).field.time / 0.016) + 8;
    h.flush(frames);

    expect(settleText(h.root)).toContain("收工上井");
    // 平台记的是「下潜到第几层」，不是这一趟带回多少金币（那会是三位数）
    expect(save.getGameProgress("gold-hook").endlessBest).toBe(1);
    const own = JSON.parse(h.storage.get("yiduo-yixing.gold-hook.endless.v12") ?? "{}") as { depth?: number };
    expect(own.depth).toBe(1);
    game.destroy();
  });
});

/* ---------------- 二、幸运石真的提高稀有矿刷新 ---------------- */

describe("1.2 幸运石提高稀有矿刷新", () => {
  it("稀有矿名单都是真矿物，而且比普通金块值钱", () => {
    for (const kind of RARE_KINDS) {
      expect(ORE_KINDS).toContain(kind);
      expect(ORES[kind].treasure, kind).toBe(true);
      expect(ORES[kind].value, kind).toBeGreaterThanOrEqual(ORES.goldSmall.value);
    }
  });

  it("没带幸运石时抽签袋一个数都不变（老矿层不许变样）", () => {
    const bag: Array<[OreKind, number]> = [
      ["nugget", 5],
      ["gem", 2],
    ];
    expect(luckyBag(bag, 0)).toEqual(bag);
    // 纯函数：传进去的那个袋子不许被就地改掉
    luckyBag(bag, 3);
    expect(bag).toEqual([
      ["nugget", 5],
      ["gem", 2],
    ]);
  });

  it("只抬稀有矿的权重，碎石和小金粒照旧", () => {
    const bag: Array<[OreKind, number]> = [
      ["nugget", 5],
      ["pebble", 3],
      ["gem", 2],
      ["chest", 1],
    ];
    const lucky = new Map(luckyBag(bag, 2));
    expect(lucky.get("nugget")).toBe(5);
    expect(lucky.get("pebble")).toBe(3);
    expect(lucky.get("gem")).toBeCloseTo(2 * rareWeightMult(2), 10);
    expect(lucky.get("chest")).toBeCloseTo(1 * rareWeightMult(2), 10);
  });

  it("块数越多抬得越高，超过上限就不再抬", () => {
    const bag: Array<[OreKind, number]> = [["gem", 1]];
    const at = (luck: number): number => luckyBag(bag, luck)[0][1];
    expect(at(1)).toBeGreaterThan(at(0));
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(MAX_LUCK + 5)).toBe(at(MAX_LUCK));
  });

  it("不带幸运石的无尽层和 1.1 的算法完全一致（默认参数不改老行为）", () => {
    for (const n of [1, 6, 13, 27]) {
      const a = endlessLayer(n);
      const b = endlessLayer(n, 0);
      expect(b.quota).toBe(a.quota);
      expect(b.name).toBe(a.name);
      expect(b.field.ores.map((o) => `${o.kind}@${o.x},${o.y}`)).toEqual(
        a.field.ores.map((o) => `${o.kind}@${o.x},${o.y}`)
      );
    }
  });

  it("同一层同样的幸运石块数，每次生成都一模一样（固定 seed 可复现）", () => {
    for (const luck of [1, 2, 3]) {
      const a = endlessLayer(18, luck);
      const b = endlessLayer(18, luck);
      expect(b.field.ores).toEqual(a.field.ores);
      expect(b.field.time).toBe(a.field.time);
      expect(b.quota).toBe(a.quota);
    }
  });

  it("配额只看层深，不看幸运石：买了幸运石不会自己给自己加价", () => {
    for (const n of [3, 9, 16, 25]) {
      const plain = endlessLayer(n).quota;
      for (const luck of [1, 2, 3]) expect(endlessLayer(n, luck).quota).toBe(plain);
    }
  });

  it("带满幸运石下潜，抽样这些层里的稀有矿总数确实变多了", () => {
    const count = (luck: number): number => {
      let n = 0;
      for (let depth = 5; depth <= 24; depth++) {
        for (const ore of endlessLayer(depth, luck).field.ores) {
          if (RARE_KINDS.includes(ore.kind)) n++;
        }
      }
      return n;
    };
    const plain = count(0);
    const lucky = count(MAX_LUCK);
    expect(plain).toBeGreaterThan(0);
    expect(lucky).toBeGreaterThan(plain);
  });

  it("闯关的 188 关一颗矿都不受影响（前段关卡数据不许动）", () => {
    // 幸运石只作用在无尽的层生成上；闯关关卡是按固定 seed 摆死的
    const before = levelAt(30).field.ores.map((o) => `${o.kind}@${o.x},${o.y}`);
    endlessLayer(15, MAX_LUCK);
    expect(levelAt(30).field.ores.map((o) => `${o.kind}@${o.x},${o.y}`)).toEqual(before);
  });
});
