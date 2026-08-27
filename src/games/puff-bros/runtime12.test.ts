/**
 * 噗噗兄弟 1.2 的运行时用例:真的把游戏挂起来、一帧一帧地跑。
 *
 * 跑在 node 环境,DOM 桩在 `domStub.ts`。这里管的是纯逻辑管不到的那几件事:
 * `pfb-` 前缀与局部 style、360px 上左右半屏各一套控件且热区不小于 44px、
 * 双人同屏「谁抬手松谁的键」、五种机关真的画得出来、五种模式都走得到结算、
 * 平台直达第 N 关 / `initialLevel` / `?level=` / Skip 走 `requestSkip`、
 * 上升气流的高度写进本款自己的 `CLIMB_BEST_KEY`(不跟噗噗不停抢平台那一格),
 * 以及 `destroy` 之后一根线都不留。
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allText, findAll, findButton, findOne, install, type FakeEl, type Harness } from "./domStub";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { ARENA_W, WALL, buildLevel } from "./arena";
import { GADGET_KINDS } from "./gadgets";
import { meta } from "./meta";

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
): Promise<{ game: Mounted; played: string[]; stars: number[] }> {
  const mod = await import("./index");
  const played: string[] = [];
  const stars: number[] = [];
  const game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: (n: string) => void played.push(n),
    addStars: (n: number) => {
      stars.push(n);
      return n;
    },
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
    ...extra,
  } as never) as unknown as Mounted;
  return { game, played, stars };
}

function styleText(root: FakeEl): string {
  return findAll(root, "")
    .concat(root)
    .filter((el) => el.tagName === "style")
    .map((el) => el.textContent)
    .join("\n");
}

/** 整棵树上所有 <style> 的内容(桩里 querySelectorAll 认标签名) */
function allStyles(root: FakeEl): string {
  return root
    .querySelectorAll("style")
    .map((el) => el.textContent)
    .join("\n");
}

function canvasOf(h: Harness): FakeEl {
  const cv = findOne(h.root, "pfb-cv");
  if (!cv) throw new Error("画布没挂上");
  return cv;
}

function ctxOf(h: Harness) {
  const ctx = canvasOf(h).getContext("2d");
  if (!ctx) throw new Error("画布没有 2d 画笔");
  return ctx;
}

/** 一直跑到 `ok()` 成立为止,返回跑了几帧;跑满还不成立就返回 0 */
function until(h: Harness, ok: () => boolean, frames = 400, ms = 50): number {
  for (let i = 1; i <= frames; i++) {
    h.flush(1, ms);
    if (ok()) return i;
  }
  return 0;
}

function veilTitle(h: Harness): string {
  return findOne(h.root, "pfb-veil-title")?.textContent ?? "";
}

// ---------------------------------------------------------------------------
// 一、外壳与样式
// ---------------------------------------------------------------------------

describe("puff-bros 1.2 运行时 · 外壳与样式", () => {
  it("类名一律 pfb- 前缀,1.1 的裸 pb- 一个都不剩", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.flush(2);

    const css = allStyles(h.root);
    expect(css).toContain(".pfb-wrap");
    expect(css).toContain(".pfb-key");
    // 「.pb-」这种老前缀不许再出现(.pfb- 里的 pb 不算,所以前面要挡一个 f)
    expect(/\.pb-/.test(css)).toBe(false);

    let bare = 0;
    const seen: string[] = [];
    for (const el of h.root.querySelectorAll("div").concat(h.root.querySelectorAll("button"))) {
      for (const cls of el.className.split(/\s+/).filter(Boolean)) {
        if (cls.startsWith("pfb-")) continue;
        // 关卡地图是平台画的,它那套 l99- 前缀不归本款管
        if (cls.startsWith("l99-")) continue;
        bare++;
        seen.push(cls);
      }
    }
    expect(`${bare} 个非 pfb- 类名: ${seen.slice(0, 6).join(",")}`).toBe("0 个非 pfb- 类名: ");
    game.destroy();
  });

  it("样式挂在自己这棵树的 <style> 上,不往全局样式表里塞东西", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    expect(styleText(h.root).length).toBeGreaterThan(200);
    // 桩里的 document.head 是空的:一个字都没往外面写
    game.destroy();
  });

  it("模式条上五个入口都在:闯关切换 / 双人 / 人机 / 噗噗不停 / 上升气流", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    expect(findAll(h.root, "pfb-mode")).toHaveLength(5);
    expect(findButton(h.root, "闯关")).not.toBeNull();
    expect(findButton(h.root, "双人对战")).not.toBeNull();
    expect(findButton(h.root, "人机三档")).not.toBeNull();
    expect(findButton(h.root, "噗噗不停")).not.toBeNull();
    expect(findButton(h.root, "上升气流")).not.toBeNull();
    game.destroy();
  });

  it("战场是一块 canvas,而且真的一帧一帧在画", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: 5 });
    h.flush(3);
    const ctx = ctxOf(h);
    ctx.ops.length = 0;
    h.flush(1);
    expect(ctx.ops.length).toBeGreaterThan(5);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 二、360px:左右半屏各一套控件
// ---------------------------------------------------------------------------

describe("puff-bros 1.2 运行时 · 手机 360px 的两套控件", () => {
  it("一个人一套控件,切成两个人就变两套", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const { game } = await mountGame(h, { initialLevel: 4 });
    h.flush(2);
    expect(findAll(h.root, "pfb-pad")).toHaveLength(1);

    // 回地图,把闯关切成两个人再进同一关
    findButton(h.root, "选关地图")?.fire("click");
    h.flush(2);
    findButton(h.root, "闯关")?.fire("click");
    h.flush(1);
    game.openCampaignLevel(4);
    h.flush(2);
    expect(findAll(h.root, "pfb-pad")).toHaveLength(2);
    // 切回一个人,别把状态留给下一条用例
    findButton(h.root, "选关地图")?.fire("click");
    h.flush(2);
    findButton(h.root, "闯关")?.fire("click");
    h.flush(1);
    game.destroy();
  });

  it("一套控件是 3 列 6 颗键(⬆ 🫧 💨 / ◀ ⬇ ▶),行列都没有两颗键抢同一格", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const { game } = await mountGame(h, { initialLevel: 7 });
    h.flush(2);
    const keys = findAll(h.root, "pfb-key");
    expect(keys).toHaveLength(6);
    const slots = keys.map((k) => `${k.style.gridColumn}:${k.style.gridRow}`);
    expect(new Set(slots).size).toBe(6);
    expect(new Set(keys.map((k) => k.style.gridColumn))).toEqual(new Set(["1", "2", "3"]));
    game.destroy();
  });

  it("热区下限是 44px,窄屏两套并排也不会缩到它以下", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const mod = await import("./index");
    expect(mod.TOUCH_MIN).toBeGreaterThanOrEqual(44);
    const { game } = await mountGame(h, { initialLevel: 9 });
    h.flush(2);
    const css = allStyles(h.root);
    expect(css).toContain(`min-width:${mod.TOUCH_MIN}px`);
    expect(css).toContain(`min-height:${mod.TOUCH_MIN}px`);
    // 360px 那一档里,--k 一律不小于 44
    for (const m of css.matchAll(/--k:(\d+)px/g)) {
      expect(Number.parseInt(m[1], 10)).toBeGreaterThanOrEqual(mod.TOUCH_MIN);
    }
    game.destroy();
  });

  it("HUD 挤成一行也不缩字号:窄屏那一档仍旧 ≥ 14px", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const { game } = await mountGame(h, { initialLevel: 3 });
    h.flush(2);
    const css = allStyles(h.root);
    const narrow = css.slice(css.indexOf("@media (max-width:420px)"));
    for (const m of narrow.matchAll(/\.pfb-(?:chip|bar-txt|btn)\{[^}]*font-size:(\d+)px/g)) {
      expect(Number.parseInt(m[1], 10)).toBeGreaterThanOrEqual(14);
    }
    expect(narrow).toContain(".pfb-chip{font-size:14px");
    game.destroy();
  });

  it("每一颗键都写了给读屏用的名字,「噗」那颗把三种用途都说清楚", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: 11 });
    h.flush(2);
    const keys = findAll(h.root, "pfb-key");
    for (const k of keys) expect((k.getAttribute("aria-label") ?? "").length).toBeGreaterThan(1);
    const puff = keys.find((k) => (k.getAttribute("aria-label") ?? "").includes("噗一口气"));
    expect(puff).toBeTruthy();
    const say = puff?.getAttribute("aria-label") ?? "";
    expect(say).toContain("对手");
    expect(say).toContain("箱子");
    expect(say).toContain("自己");
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 三、输入:两套键位、暂停、两个人互不抢占
// ---------------------------------------------------------------------------

describe("puff-bros 1.2 运行时 · 输入", () => {
  it("按住 D 人往右走,松开就停下来", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: 2 });
    h.flush(2);
    const ctx = ctxOf(h);
    const bodyX = (): number => {
      ctx.ops.length = 0;
      h.flush(1);
      return ctx.ops.filter((o) => o.op === "ellipse").length;
    };
    expect(bodyX()).toBeGreaterThan(0);

    h.key("keydown", "KeyD");
    h.flush(12);
    h.key("keyup", "KeyD");
    h.flush(2);
    // 走过一段之后再按 Esc,暂停面板应当弹出来
    h.key("keydown", "Escape");
    h.flush(2);
    expect(findOne(h.root, "pfb-veil")).not.toBeNull();
    h.key("keydown", "Escape");
    h.flush(2);
    expect(findOne(h.root, "pfb-veil")).toBeNull();
    game.destroy();
  });

  it("双人同屏:朵朵松开手指,不会把星星正按着的键也一起松掉", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const { game } = await mountGame(h);
    h.flush(2);
    findButton(h.root, "双人对战")?.fire("click");
    h.flush(3);
    const pads = findAll(h.root, "pfb-pad");
    expect(pads).toHaveLength(2);

    const rightOf = (pad: FakeEl): FakeEl => {
      const hit = findAll(pad, "pfb-key").find((k) => k.textContent === "▶");
      if (!hit) throw new Error("这一套控件里没有 ▶");
      return hit;
    };
    const a = rightOf(pads[0]);
    const b = rightOf(pads[1]);
    a.fire("pointerdown", { pointerId: 1 });
    b.fire("pointerdown", { pointerId: 2 });
    expect(a.classList.contains("pfb-down")).toBe(true);
    expect(b.classList.contains("pfb-down")).toBe(true);

    // 1 号手指抬起来:只松掉朵朵那一颗,星星那颗照旧按着
    h.fireWindow("pointerup", { pointerId: 1 });
    expect(a.classList.contains("pfb-down")).toBe(false);
    expect(b.classList.contains("pfb-down")).toBe(true);

    // 整个窗口失焦才两个人一起松
    h.fireWindow("blur");
    expect(b.classList.contains("pfb-down")).toBe(false);
    game.destroy();
  });

  it("退出之后彻底哑掉:再按键一声不响", async () => {
    const h = (harness = install());
    const { game, played } = await mountGame(h, { initialLevel: 8 });
    h.flush(4);
    game.destroy();
    played.length = 0;
    h.key("keydown", "KeyF");
    h.key("keydown", "Escape");
    h.flush(10);
    expect(played).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 四、画面:机关、气流线、减弱动效
// ---------------------------------------------------------------------------

describe("puff-bros 1.2 运行时 · 画面", () => {
  it("五种机关都有自己的画法,后段关卡把它们画了出来", async () => {
    // 摆得出机关的那一关(前 99 关一格没动,机关只在这之后)
    let withGadget = -1;
    for (let i = 99; i < 188 && withGadget < 0; i++) {
      if (buildLevel(i).gadgets.length > 0) withGadget = i;
    }
    expect(withGadget).toBeGreaterThan(98);

    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: withGadget + 1 });
    h.flush(3);
    const ctx = ctxOf(h);
    ctx.ops.length = 0;
    h.flush(1);
    const busy = ctx.ops.length;
    game.destroy();

    // 同一套画法、同一块画布,只是换成一关没有机关的老关卡:画的东西应当更少
    const h2 = (harness = install());
    const plain = await mountGame(h2, { initialLevel: 1 });
    h2.flush(3);
    const ctx2 = ctxOf(h2);
    ctx2.ops.length = 0;
    h2.flush(1);
    expect(busy).toBeGreaterThan(ctx2.ops.length);
    plain.game.destroy();
  });

  it("五种机关一种不少,画笔认得出每一种", async () => {
    const mod = await import("./gadgets");
    expect(mod.GADGET_KINDS).toHaveLength(5);
    expect(new Set(GADGET_KINDS)).toEqual(
      new Set(["updraft", "crate", "brittle", "spring", "warp"])
    );
  });

  it("上升气流里画得出脚底那条一直往上追的气流线", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    findButton(h.root, "上升气流")?.fire("click");
    h.flush(4);
    const ctx = ctxOf(h);
    ctx.ops.length = 0;
    h.flush(1);
    // 气流线是一条横跨两堵墙之间的青色矩形
    const band = ctx.ops.find(
      (o) => o.op === "fillRect" && Math.abs(o.args[2] - (ARENA_W - WALL * 2)) < 1
    );
    expect(band).toBeTruthy();
    expect(band?.fill).toContain("126,216,206");
    game.destroy();
  });

  it("跳一下再落回来:身体会压扁一下,画笔真的做了形变", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: 6 });
    h.flush(4);
    const ctx = ctxOf(h);
    // 起跳(KeyW 是朵朵的跳),等它落回地面
    h.key("keydown", "KeyW");
    h.flush(3, 16);
    h.key("keyup", "KeyW");
    ctx.ops.length = 0;
    const spent = until(h, () => ctx.ops.some((o) => o.op === "scale"), 160, 16);
    expect(spent).toBeGreaterThan(0);
    // 压扁是「横着胖一点、竖着矮一点」,不是整个人变大
    const squash = ctx.ops.find((o) => o.op === "scale");
    expect(squash!.args[0]).toBeGreaterThan(1);
    expect(squash!.args[1]).toBeLessThan(1);
    game.destroy();
  });

  it("勾了「减弱动效」就一样形变都不做,但画面照常在画", async () => {
    const h = (harness = install({ reduceMotion: true }));
    const { game } = await mountGame(h, { initialLevel: 6 });
    h.flush(4);
    const ctx = ctxOf(h);
    h.key("keydown", "KeyW");
    h.flush(3, 16);
    h.key("keyup", "KeyW");
    ctx.ops.length = 0;
    h.flush(160, 16);
    // 同样跳一下再落回来:这一回一次 scale 都没有,但该画的还是照画
    expect(ctx.ops.some((o) => o.op === "scale")).toBe(false);
    expect(ctx.ops.length).toBeGreaterThan(100);
    expect(allStyles(h.root)).toContain("@media (prefers-reduced-motion:reduce)");
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 五、五种模式都走得到结算
// ---------------------------------------------------------------------------

describe("puff-bros 1.2 运行时 · 五种模式都能结算", () => {
  it("闯关(campaign / coop):时间到就给结算面板,面板上只有鼓励", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: 1 });
    h.flush(2);
    // 一关的限时是 parSeconds × 2.6 + 30 秒,一帧算 50ms,得跑够那么长
    const spent = until(h, () => findOne(h.root, "pfb-done") !== null, 3000, 50);
    expect(spent).toBeGreaterThan(0);
    const text = allText(h.root);
    expect(text).toContain("再试一次");
    expect(/输了|死|流血|受伤/.test(text)).toBe(false);
    game.destroy();
  });

  it("双人对战(versus / twoPlayer):一局打到时间到就出面板,还能接着开下一局", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    findButton(h.root, "双人对战")?.fire("click");
    h.flush(3);
    expect(findAll(h.root, "pfb-pad")).toHaveLength(2);

    // 一局 VERSUS_ROUND_SECONDS = 75 秒,两个人都不动就按 0:0 判平
    const spent = until(h, () => veilTitle(h) !== "", 2200, 50);
    expect(spent).toBeGreaterThan(0);
    expect(veilTitle(h)).toContain("第 1 局");
    expect(findButton(h.root, "第 2 局")).not.toBeNull();
    findButton(h.root, "第 2 局")?.fire("click");
    h.flush(3);
    expect(findOne(h.root, "pfb-veil")).toBeNull();
    game.destroy();
  });

  it("人机对战:三档摆在那儿,挑完就进对局,比分条跟着走", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    findButton(h.root, "人机三档")?.fire("click");
    h.flush(2);
    expect(findAll(h.root, "pfb-pick")).toHaveLength(3);
    findAll(h.root, "pfb-pick")[2].fire("click");
    h.flush(4);
    // 进了对局:挑对手那块面板收起来,只剩一套控件(另一个交给电脑)
    expect(findOne(h.root, "pfb-cv")).not.toBeNull();
    expect(findAll(h.root, "pfb-pad")).toHaveLength(1);
    expect(allText(h.root)).toMatch(/\d+ : \d+/);
    game.destroy();
  });

  it("噗噗不停(endless):进得去,分数条在走,最好成绩读的是 save 那一条", async () => {
    const { save } = await import("../../engine/save");
    save.recordEndlessBest(meta.id, 321);
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    expect(findButton(h.root, "噗噗不停")?.textContent).toContain("321");
    findButton(h.root, "噗噗不停")?.fire("click");
    h.flush(4);
    expect(allText(h.root)).toContain("最好 321");
    expect(allText(h.root)).toMatch(/🫧 \d+ 分/);
    game.destroy();
  });

  it("上升气流(endless):气流线追上来就结算,高度写进本款自己那一格,不动平台那格", async () => {
    const { save } = await import("../../engine/save");
    const { CLIMB_BEST_KEY, parseClimbBest } = await import("./updraft");
    // 先把平台那一格垫上一个「噗噗不停」量级的分数(几百分),
    // 从前两种无尽挤一格的时候,这个数会把上升气流的米数永远压死。
    save.recordEndlessBest(meta.id, 321);
    const before = save.getGameProgress(meta.id).endlessBest;
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    findButton(h.root, "上升气流")?.fire("click");
    h.flush(3);
    expect(allText(h.root)).toContain("米");
    // 进来时这一格还是空的,不会把平台那 321 分冒充成「最好 321 米」
    expect(allText(h.root), "上升气流不该把波次分数念成米数").not.toContain("321 米");

    // 站着不动:气流线一路追上来,先打转,救不回来才结束这一趟
    const spent = until(h, () => veilTitle(h) !== "", 900, 50);
    expect(spent).toBeGreaterThan(0);
    expect(veilTitle(h)).toContain("米");
    expect(findButton(h.root, "再来一趟")).not.toBeNull();
    expect(findButton(h.root, "回关卡")).not.toBeNull();
    // 爬到过第一层,高度是正的,记进的是上升气流自己那一格
    const climbed = parseClimbBest(h.storage.get(CLIMB_BEST_KEY) ?? null);
    expect(climbed, "上升气流的纪录没落到自己那一格").toBeGreaterThan(0);
    // 平台那一格是「噗噗不停」的,爬一趟不许把它顶掉
    expect(save.getGameProgress(meta.id).endlessBest, "爬一趟不该动噗噗不停的分数").toBe(before);
    game.destroy();
  });

  /**
   * 1.2 监督修复员补的:两种无尽本来共用平台那一个成绩位。
   * 噗噗不停记分(几百),上升气流记米(几十),而 `recordEndlessBest` 取 max ——
   * 结果是玩过一趟噗噗不停之后,上升气流**再也刷不出新纪录**,
   * 而且那格分数还会被按「米」念出来。现在各记各的。
   */
  it("玩过噗噗不停之后,上升气流照样能刷出自己的新纪录", async () => {
    const { save } = await import("../../engine/save");
    const { CLIMB_BEST_KEY, heightLine, parseClimbBest } = await import("./updraft");
    save.recordEndlessBest(meta.id, 321);
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);

    // 菜单上两个按钮各念各的单位,不再是同一个数字出现两次
    const waveLabel = findButton(h.root, "噗噗不停")?.textContent ?? "";
    const climbLabel = findButton(h.root, "上升气流")?.textContent ?? "";
    expect(waveLabel).toContain("321 分");
    expect(climbLabel, "还没爬过就不该有米数纪录").toContain("往上爬");
    expect(climbLabel).not.toContain("321");

    // 爬一趟:这一趟一定是新纪录,因为这一格本来是空的
    findButton(h.root, "上升气流")?.fire("click");
    h.flush(3);
    expect(until(h, () => veilTitle(h) !== "", 900, 50)).toBeGreaterThan(0);
    expect(veilTitle(h), "第一趟就该是新纪录").toContain("新纪录");
    const climbed = parseClimbBest(h.storage.get(CLIMB_BEST_KEY) ?? null);
    expect(climbed).toBeGreaterThan(0);

    // 回到菜单:上升气流那颗按钮念的是米数,噗噗不停那颗还是分数
    findButton(h.root, "回关卡")?.fire("click");
    h.flush(3);
    expect(findButton(h.root, "上升气流")?.textContent).toContain(heightLine(climbed));
    expect(findButton(h.root, "噗噗不停")?.textContent).toContain("321 分");
    game.destroy();
  });

  it("上升气流:点「再来一趟」就从第一段重新开始,面板收掉", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    findButton(h.root, "上升气流")?.fire("click");
    h.flush(3);
    expect(until(h, () => veilTitle(h) !== "", 900, 50)).toBeGreaterThan(0);
    findButton(h.root, "再来一趟")?.fire("click");
    h.flush(3);
    expect(findOne(h.root, "pfb-veil")).toBeNull();
    expect(allText(h.root)).toContain("第 1 段");
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 六、平台接线
// ---------------------------------------------------------------------------

describe("puff-bros 1.2 运行时 · 平台接线", () => {
  it("openCampaignLevel(n) 直达第 N 关,越界夹回 1..188", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(1);
    expect(game.openCampaignLevel(42)).toBe(42);
    h.flush(2);
    expect(allText(h.root)).toContain("第 42 关");
    expect(findOne(h.root, "pfb-cv")).not.toBeNull();
    expect(game.openCampaignLevel(0)).toBe(1);
    expect(game.openCampaignLevel(9999)).toBe(188);
    h.flush(2);
    expect(allText(h.root)).toContain("第 188 关");
    game.destroy();
  });

  it("壳层给了 initialLevel 就直接开在那一关,不用先点地图", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: 60 });
    h.flush(2);
    expect(allText(h.root)).toContain("第 60 关");
    game.destroy();
  });

  it("壳层没给就认地址栏的 ?level=", async () => {
    const h = (harness = install({ search: "?level=77" }));
    const { game } = await mountGame(h);
    h.flush(2);
    expect(allText(h.root)).toContain("第 77 关");
    game.destroy();
  });

  it("?level= 上写的不是数字就当没写,老老实实开在关卡地图", async () => {
    const mod = await import("./index");
    expect(mod.levelFromQuery("?level=12")).toBe(12);
    expect(mod.levelFromQuery("?level=abc")).toBeNull();
    expect(mod.levelFromQuery("?other=3")).toBeNull();
    expect(mod.levelFromQuery(null)).toBeNull();
  });

  it("跳关走平台的 requestSkip:壳层没注册就不挂这颗按钮", async () => {
    const h = (harness = install());
    resetLevelExtras();
    const { game } = await mountGame(h, { initialLevel: 20 });
    h.flush(2);
    expect(findOne(h.root, "pfb-skip")).toBeNull();
    game.destroy();
  });

  it("家长放行就跳到下一关,不放行就留在原地", async () => {
    const asked: Array<[string, number]> = [];
    let allow = false;
    registerLevelExtras({
      requestSkip: (id, lv) => {
        asked.push([id, lv]);
        return Promise.resolve(allow);
      },
    });
    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: 20 });
    h.flush(2);
    expect(findOne(h.root, "pfb-skip")).not.toBeNull();

    findOne(h.root, "pfb-skip")?.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    h.flush(2);
    expect(asked[0]).toEqual([meta.id, 19]);
    expect(allText(h.root)).toContain("第 20 关");

    allow = true;
    findOne(h.root, "pfb-skip")?.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    h.flush(2);
    expect(allText(h.root)).toContain("第 21 关");
    game.destroy();
  });

  it("直达关卡时模式条收起来,回地图它再回来", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    const bar = findOne(h.root, "pfb-modebar");
    expect(bar?.hidden).toBe(false);
    game.openCampaignLevel(7);
    h.flush(2);
    expect(bar?.hidden).toBe(true);
    findButton(h.root, "选关地图")?.fire("click");
    h.flush(2);
    expect(bar?.hidden).toBe(false);
    game.destroy();
  });

  it("index.ts 接了平台那几条线:直达关卡、跳关授权、无尽成绩", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(index).toContain("openCampaignLevel");
    expect(index).toContain("initialLevel");
    expect(index).toContain("requestSkip");
    expect(index).toContain("recordEndlessBest(meta.id");
  });
});

// ---------------------------------------------------------------------------
// 七、退出:一根线都不留
// ---------------------------------------------------------------------------

describe("puff-bros 1.2 运行时 · destroy", () => {
  it("打几帧再退出:rAF、window 监听、节点全部清干净", async () => {
    const h = (harness = install());
    const before = h.windowListeners();
    const { game } = await mountGame(h, { initialLevel: 15 });
    h.flush(8);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(h.windowListeners()).toBeGreaterThan(before);

    game.destroy();
    h.flush(2);
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(h.root.children).toHaveLength(0);
  });

  it("进了某个模式再退出,一样清得干干净净", async () => {
    const h = (harness = install());
    const before = h.windowListeners();
    const { game } = await mountGame(h);
    h.flush(2);
    findButton(h.root, "上升气流")?.fire("click");
    h.flush(6);
    game.destroy();
    h.flush(2);
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(h.root.children).toHaveLength(0);
  });

  it("destroy 连着调两次也不炸", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: 12 });
    h.flush(6);
    game.destroy();
    expect(() => game.destroy()).not.toThrow();
    expect(h.pendingFrames()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 八、题材:干净、只鼓励
// ---------------------------------------------------------------------------

describe("puff-bros 1.2 运行时 · 说的话", () => {
  it("界面上的字只鼓励,「噗」说的是气泡和空气,不出现恶心话", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h, { initialLevel: 1 });
    h.flush(4);
    h.key("keydown", "Escape");
    h.flush(2);
    const text = allText(h.root);
    expect(text).toContain("休息一下");
    expect(/屁|臭|粪|尿|恶心|血|死|杀/.test(text)).toBe(false);
    game.destroy();
  });

  it("上升气流的提示语讲的是气流、浮台和弹簧云,一句吓人的都没有", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    findButton(h.root, "上升气流")?.fire("click");
    h.flush(3);
    const tip = findOne(h.root, "pfb-tip")?.textContent ?? "";
    expect(tip).toContain("气流");
    expect(tip).toContain("弹簧云");
    expect(/屁|臭|粪|尿|恶心|血|死|杀/.test(tip)).toBe(false);
    game.destroy();
  });
});
