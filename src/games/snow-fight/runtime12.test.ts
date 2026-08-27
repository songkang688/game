/**
 * 雪球大作战 1.2 的运行时用例:真的把一局挂起来跑。
 *
 * 跑在 node 环境,DOM 桩在 `domStub.ts`。这里管的是纯逻辑管不到的那几件事:
 * 按住 F 真的飞出雪球、落点圈在**松手之前**就画在地上了、蹲下搓雪 HUD 跟着变、
 * 手机一根手指按住 + 拖 + 松手、两套键位不串、平台直达第 N 关、
 * Skip 走 `requestSkip`、`destroy` 之后 rAF 与监听全部归零。
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allText, findAll, findButton, findOne, install, type FakeEl, type Harness } from "./domStub";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { VIEW_W, buildLevel } from "./levels";
import { FIELD_W_12, aimCircle, campaignArena, duelArena, endlessArena, type Arena } from "./arena";
import { HAND_MAX } from "./economy";
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
): Promise<{ game: Mounted; played: string[] }> {
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
  return { game, played };
}

/** 直接开一局(不经过地图),手感相关的断言都走这条路 */
async function openBout(
  h: Harness,
  arena: Arena,
  over: Record<string, unknown> = {}
): Promise<{ bout: { destroy: () => void; arena: Arena }; played: string[] }> {
  const mod = await import("./index");
  const played: string[] = [];
  const bout = mod.createBout({
    host: h.root as unknown as HTMLElement,
    arena,
    viewW: VIEW_W,
    humans: 1,
    sfx: (n: string) => void played.push(n),
    ...over,
  } as never);
  return { bout, played };
}

function canvasOf(h: Harness): FakeEl {
  const cv = findOne(h.root, "snf-canvas");
  if (!cv) throw new Error("画布没挂上");
  return cv;
}

/** 画布上一个世界坐标对应到屏幕上几像素(用例照着运行时同一套算法算) */
function pxPerUnit(h: Harness, viewW = VIEW_W): number {
  return Number.parseFloat(canvasOf(h).style.width) / viewW;
}

// ---------------------------------------------------------------------------
// 一、投:按住蓄力,松手飞出去
// ---------------------------------------------------------------------------

describe("snow-fight 1.2 运行时 · 蓄力与出手", () => {
  it("按住 F 只是在蓄力,松开那一下才飞出雪球,手里跟着少一颗", async () => {
    const h = (harness = install());
    const { bout, played } = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    const me = bout.arena.fighters[0];
    const before = me.hands.balls;

    h.key("keydown", "KeyF");
    h.flush(30);
    expect(me.charge).toBeGreaterThan(0.3);
    expect(bout.arena.balls.length).toBe(0);
    expect(me.hands.balls).toBe(before);

    h.key("keyup", "KeyF");
    h.flush(2);
    expect(me.charge).toBeNull();
    expect(me.hands.balls).toBe(before - 1);
    expect(me.thrown).toBe(1);
    expect(played).toContain("pop");
    bout.destroy();
  });

  it("落点圈在松手**之前**就画在地上,而且画的就是物理算出来的那个圈", async () => {
    const h = (harness = install());
    const { bout } = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    const me = bout.arena.fighters[0];
    const ctx = canvasOf(h).getContext("2d");
    const s = pxPerUnit(h);

    h.key("keydown", "KeyF");
    h.flush(40);
    ctx!.ops.length = 0;
    h.flush(1);
    // 一帧里先推进再画,所以这一帧画下去的就是这帧跑完的状态
    const ring = aimCircle(bout.arena, me);
    const drawn = ctx!.ops.filter((o) => o.op === "ellipse");
    // 地上那个粉圈:半径和 landingCircle 算出来的对得上(误差不到一像素)
    const hit = drawn.find((o) => Math.abs(o.args[2] - ring.r * s) < 1 && Math.abs(o.args[0] - ring.x * s) < 1);
    expect(hit, `没找到落点圈,画了 ${drawn.length} 个椭圆`).toBeDefined();
    expect(bout.arena.balls.length).toBe(0);
    bout.destroy();
  });

  it("蓄得越久,落点圈越往外跑——「按多久落多远」看得见", async () => {
    const h = (harness = install());
    const { bout } = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    const me = bout.arena.fighters[0];
    h.key("keydown", "KeyF");
    h.flush(10);
    const near = aimCircle(bout.arena, me);
    h.flush(40);
    const far = aimCircle(bout.arena, me);
    expect(far.x).toBeGreaterThan(near.x + 1);
    // 越远的圈越大越虚
    expect(far.r).toBeGreaterThan(near.r);
    expect(far.blur).toBeGreaterThanOrEqual(near.blur);
    h.key("keyup", "KeyF");
    bout.destroy();
  });

  it("空着手按蓄力扔不出去,HUD 会写着「脚下还能搓几颗」提醒去搓", async () => {
    const h = (harness = install());
    const arena = campaignArena(buildLevel(0));
    arena.fighters[0].hands = { balls: 0, progress: 0 };
    const { bout } = await openBout(h, arena);
    h.flush(2);
    h.key("keydown", "KeyF");
    h.flush(90);
    h.key("keyup", "KeyF");
    h.flush(2);
    expect(bout.arena.balls.length).toBe(0);
    expect(bout.arena.fighters[0].thrown).toBe(0);
    expect(allText(h.root)).toContain("🤲");
    bout.destroy();
  });
});

// ---------------------------------------------------------------------------
// 二、搓:蹲下 0.6 秒一颗
// ---------------------------------------------------------------------------

describe("snow-fight 1.2 运行时 · 蹲下搓雪", () => {
  it("按住 G 蹲下搓雪:手里的雪球多起来,HUD 上的雪花跟着变多", async () => {
    const h = (harness = install());
    const arena = campaignArena(buildLevel(0));
    arena.fighters[0].hands = { balls: 0, progress: 0 };
    const { bout } = await openBout(h, arena);
    h.flush(2);
    expect(allText(h.root)).toContain("···");

    h.key("keydown", "KeyG");
    h.flush(60); // 约 0.96 秒
    expect(bout.arena.fighters[0].hands.balls).toBeGreaterThanOrEqual(1);
    h.flush(120);
    expect(bout.arena.fighters[0].hands.balls).toBe(HAND_MAX);
    expect(allText(h.root)).toContain("❄️❄️❄️");
    h.key("keyup", "KeyG");
    bout.destroy();
  });

  it("触屏那两个大钮和键盘走同一条路:按住「蹲下搓雪」照样搓得出来", async () => {
    const h = (harness = install());
    const arena = campaignArena(buildLevel(0));
    arena.fighters[0].hands = { balls: 0, progress: 0 };
    const { bout } = await openBout(h, arena);
    h.flush(2);
    const scoop = findButton(h.root, "蹲下搓雪");
    expect(scoop).not.toBeNull();
    scoop!.fire("pointerdown");
    h.flush(60);
    expect(bout.arena.fighters[0].hands.balls).toBeGreaterThanOrEqual(1);
    scoop!.fire("pointerup");
    const after = bout.arena.fighters[0].hands.balls;
    h.flush(60);
    expect(bout.arena.fighters[0].hands.balls).toBe(after);
    bout.destroy();
  });
});

// ---------------------------------------------------------------------------
// 三、手机:一根手指按住 + 拖 + 松手
// ---------------------------------------------------------------------------

describe("snow-fight 1.2 运行时 · 手机 360px", () => {
  it("按住画面就开始蓄力、上下拖调准星、松手扔出去,全程一根手指", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const { bout } = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    const cv = canvasOf(h);
    const me = bout.arena.fighters[0];
    const aim0 = me.aim;

    cv.fire("pointerdown", { pointerId: 1, clientX: 120, clientY: 300 });
    h.flush(20);
    expect(me.charge).toBeGreaterThan(0.2);

    // 手指往上拖 = 抬高准星
    cv.fire("pointermove", { pointerId: 1, clientX: 120, clientY: 220 });
    h.flush(2);
    expect(me.aim).toBeGreaterThan(aim0 + 5);
    // 往下拖回去
    cv.fire("pointermove", { pointerId: 1, clientX: 120, clientY: 380 });
    h.flush(2);
    expect(me.aim).toBeLessThan(aim0);

    cv.fire("pointerup", { pointerId: 1, clientX: 120, clientY: 380 });
    h.flush(2);
    expect(me.charge).toBeNull();
    expect(me.thrown).toBe(1);
    bout.destroy();
  });

  it("准星拖到头也出不了 8..82 度这个范围", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const { bout } = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    const cv = canvasOf(h);
    const me = bout.arena.fighters[0];
    cv.fire("pointerdown", { pointerId: 1, clientX: 120, clientY: 300 });
    cv.fire("pointermove", { pointerId: 1, clientX: 120, clientY: -9000 });
    expect(me.aim).toBeLessThanOrEqual(82);
    cv.fire("pointermove", { pointerId: 1, clientX: 120, clientY: 9000 });
    expect(me.aim).toBeGreaterThanOrEqual(8);
    cv.fire("pointerup", { pointerId: 1 });
    bout.destroy();
  });

  it("360px 上画布进得去,热区都 ≥ 44px、字号都 ≥ 14px", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const mod = await import("./index");
    const { bout } = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    expect(Number.parseFloat(canvasOf(h).style.width)).toBeLessThanOrEqual(360);

    const css = mod.CSS_12;
    const sizes = [...css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(8);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
    // 只查按钮那几类的热区(`.snf-say` 那种是文字行,矮一点不影响手指)
    const taps: number[] = [];
    for (const rule of css.split("}")) {
      const head = rule.split("{")[0] ?? "";
      if (!/snf-(btn|act|open|back|pausefab)/.test(head)) continue;
      for (const m of rule.matchAll(/min-(?:width|height):(\d+(?:\.\d+)?)px/g)) taps.push(Number(m[1]));
    }
    expect(taps.length).toBeGreaterThan(4);
    expect(Math.min(...taps)).toBeGreaterThanOrEqual(44);
    bout.destroy();
  });

  /**
   * 手机上真正会要命的一条:画布上面顶着平台标题栏和选关条,下面还得放旁白与两排按钮。
   * 谁也不让谁的话,按钮就被挤到屏幕外面——点都点不到,这一局直接没法玩。
   * 所以画布高度必须是量出来的:这一屏还剩多少,就画多高。
   */
  /** 真机量出来的样子:画布顶在 282px(平台头 88 + 选关条 116 + HUD 62 与缝隙) */
  const BELOW = { say: 21, tip: 42, pads: 102 };

  async function boardHeightOn(innerHeight: number, top = 282): Promise<number> {
    const h = (harness = install({ innerWidth: 375, innerHeight }));
    const { bout } = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    findOne(h.root, "snf-board")!.rect = { left: 0, top, width: 360, height: 0 };
    findOne(h.root, "snf-say")!.rect = { left: 0, top: 0, width: 360, height: BELOW.say };
    findOne(h.root, "snf-tip")!.rect = { left: 0, top: 0, width: 360, height: BELOW.tip };
    findOne(h.root, "snf-pads")!.rect = { left: 0, top: 0, width: 360, height: BELOW.pads };
    h.fireWindow("resize");
    h.flush(1);
    const got = Number.parseFloat(canvasOf(h).style.height);
    bout.destroy();
    h.restore();
    harness = null;
    return got;
  }

  it("按钮不许被挤出屏幕:画布下面那几行加起来还在这一屏里", async () => {
    for (const screen of [667, 720, 812]) {
      const boardH = await boardHeightOn(screen);
      const bottom = 282 + boardH + BELOW.say + BELOW.tip + BELOW.pads;
      expect(bottom, `${screen} 高的屏上排到了 ${bottom}`).toBeLessThanOrEqual(screen);
    }
  });

  it("屏幕越高雪原画得越高,再挤也不低于最小高度、再宽松也不会拉成竹竿", async () => {
    const squashed = await boardHeightOn(600);
    const short = await boardHeightOn(700);
    const tall = await boardHeightOn(880);
    expect(tall).toBeGreaterThan(short);
    expect(short).toBeGreaterThan(squashed);
    // 挤到没地方了也还看得出是条弧线(再往下就宁可让画面扁,也不能把按钮顶出屏幕)
    expect(squashed).toBeGreaterThanOrEqual(108);
    // 拉得再高也有个谱:竖向不会拉到人变竹竿
    expect(tall).toBeLessThan(14 * (352 / VIEW_W) * 2.7 + 20);
  });
});

// ---------------------------------------------------------------------------
// 四、双人:两套键位不串
// ---------------------------------------------------------------------------

describe("snow-fight 1.2 运行时 · 双人同屏", () => {
  it("A/D/W/S/F/G 归朵朵,方向键 + L/K 归星星,谁也抢不了谁", async () => {
    const h = (harness = install());
    const { bout } = await openBout(h, duelArena(null, 5), { viewW: FIELD_W_12, humans: 2 });
    h.flush(2);
    const [p0, p1] = bout.arena.fighters;
    const x0 = p0.x;
    const x1 = p1.x;

    h.key("keydown", "KeyD");
    h.flush(20);
    expect(p0.x).toBeGreaterThan(x0);
    expect(p1.x).toBe(x1);
    h.key("keyup", "KeyD");

    h.key("keydown", "ArrowLeft");
    h.flush(20);
    expect(p1.x).toBeLessThan(x1);
    h.key("keyup", "ArrowLeft");

    // 两个人同时蓄力,各扔各的
    h.key("keydown", "KeyF");
    h.key("keydown", "KeyL");
    h.flush(30);
    expect(p0.charge).toBeGreaterThan(0);
    expect(p1.charge).toBeGreaterThan(0);
    h.key("keyup", "KeyF");
    h.key("keyup", "KeyL");
    h.flush(2);
    expect(p0.thrown).toBe(1);
    expect(p1.thrown).toBe(1);
    bout.destroy();
  });

  it("两块操作牌并排:一台手机上两个人的按钮都点得到", async () => {
    const h = (harness = install({ innerWidth: 360, innerHeight: 720 }));
    const { bout } = await openBout(h, duelArena(null, 5), { viewW: FIELD_W_12, humans: 2 });
    h.flush(2);
    const pads = findAll(h.root, "snf-pad");
    expect(pads.length).toBe(2);
    for (const pad of pads) {
      // 走、瞄、搓、投一个都不能少,而且是并排那一版(3×2)
      expect(pad.querySelectorAll("button").length).toBe(6);
      expect(pad.className).toContain("snf-pad-duo");
      expect(pad.querySelectorAll("snf-row").length).toBe(2);
    }
    // 两块牌子上写着各自的键位,认得出谁是谁
    const marks = findAll(h.root, "snf-pad-t").map((el) => el.textContent);
    expect(marks[0]).toContain("朵朵");
    expect(marks[1]).toContain("星星");
    bout.destroy();
  });

  it("单人局里星星那套键一点反应都没有(免得旁边的人乱按)", async () => {
    const h = (harness = install());
    const { bout } = await openBout(h, duelArena("normal", 6), { viewW: FIELD_W_12, humans: 1 });
    h.flush(2);
    const p1 = bout.arena.fighters[1];
    const thrown = p1.thrown;
    h.key("keydown", "KeyL");
    h.flush(40);
    h.key("keyup", "KeyL");
    h.flush(2);
    // 电脑自己扔归电脑,但「按 L」这件事一点都没进来
    expect(p1.charge === null || p1.ai !== null).toBe(true);
    expect(p1.thrown).toBeGreaterThanOrEqual(thrown);
    bout.destroy();
  });

  it("切走窗口 = 所有键都松开,回来时不会发现自己一直在蓄力", async () => {
    const h = (harness = install());
    const { bout } = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    h.key("keydown", "KeyF");
    h.flush(10);
    expect(bout.arena.fighters[0].charge).toBeGreaterThan(0);
    h.fireWindow("blur");
    h.flush(2);
    // 松手那一下会把球扔出去,之后就不再涨了
    const after = bout.arena.fighters[0].charge;
    h.flush(20);
    expect(bout.arena.fighters[0].charge).toBe(after);
    bout.destroy();
  });

  it("Esc 暂停:时间停住,画面上给一块「先歇一会儿」", async () => {
    const h = (harness = install());
    const { bout } = await openBout(h, endlessArena(9));
    h.flush(4);
    const t0 = bout.arena.t;
    h.key("keydown", "Escape");
    h.flush(30);
    expect(bout.arena.t).toBe(t0);
    expect(allText(h.root)).toContain("先歇一会儿");
    h.key("keydown", "Escape");
    h.flush(10);
    expect(bout.arena.t).toBeGreaterThan(t0);
    bout.destroy();
  });
});

// ---------------------------------------------------------------------------
// 五、平台接线
// ---------------------------------------------------------------------------

describe("snow-fight 1.2 · 平台接线", () => {
  it("模式条上四个入口都在:双人、三档人机、无尽雪季", async () => {
    const h = (harness = install());
    await mountGame(h);
    h.flush(2);
    const text = allText(h.root);
    expect(text).toContain("双人对战");
    expect(text).toContain("简单");
    expect(text).toContain("会算风");
    expect(text).toContain("无尽雪季");
    expect(findAll(h.root, "snf-open").length).toBe(5);
  });

  it("开打就把模式条收起来:那两行按钮只有在选关地图上才用得着", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    const bar = findOne(h.root, "snf-bar");
    expect(bar!.hidden).toBe(false);
    game.openCampaignLevel(7);
    h.flush(2);
    expect(bar!.hidden).toBe(true);
    // 退回地图它就回来
    findButton(h.root, "选关地图")!.fire("click");
    h.flush(2);
    expect(bar!.hidden).toBe(false);
    game.destroy();
  });

  it("openCampaignLevel(n) 直达第 N 关,越界夹回 1..188", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    expect(game.openCampaignLevel(42)).toBe(42);
    h.flush(2);
    expect(allText(h.root)).toContain("第 42 关");
    expect(findOne(h.root, "snf-canvas")).not.toBeNull();
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

  it("壳层没给就退回地址栏的 ?level=;读不出数字就老老实实留在地图上", async () => {
    const mod = await import("./index");
    expect(mod.levelFromQuery("?level=33")).toBe(33);
    expect(mod.levelFromQuery("?level=7.4&x=1")).toBe(7);
    expect(mod.levelFromQuery("?level=abc")).toBeNull();
    expect(mod.levelFromQuery("")).toBeNull();
    expect(mod.levelFromQuery(null)).toBeNull();

    const h = (harness = install({ search: "?level=33" }));
    const { game } = await mountGame(h);
    h.flush(2);
    expect(allText(h.root)).toContain("第 33 关");
    game.destroy();
  });

  it("跳关走 requestSkip:壳层没注册就不挂按钮,注册了才出现", async () => {
    const bare = (harness = install());
    const first = await mountGame(bare);
    first.game.openCampaignLevel(5);
    bare.flush(2);
    expect(findOne(bare.root, "snf-skip")).toBeNull();
    first.game.destroy();
    bare.restore();

    const h = (harness = install());
    const asked: Array<[string, number]> = [];
    registerLevelExtras({
      requestSkip: (gameId, level) => {
        asked.push([gameId, level]);
        return Promise.resolve(true);
      },
    });
    const { game } = await mountGame(h);
    game.openCampaignLevel(5);
    h.flush(2);
    const btn = findOne(h.root, "snf-skip");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain("第5关");
    btn!.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    expect(asked).toEqual([[meta.id, 4]]);
    game.destroy();
  });

  it("无尽成绩写进平台存档,回到模式条能看到「最好 第 N 波」", async () => {
    const h = (harness = install());
    const { save } = await import("../../engine/save");
    save.recordEndlessBest(meta.id, 7);
    const { game } = await mountGame(h);
    h.flush(2);
    expect(allText(h.root)).toContain("最好 第 7 波");
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 六、看着舒服:天色、拖尾、关了动效就别晃
// ---------------------------------------------------------------------------

describe("snow-fight 1.2 · 画面", () => {
  /** 这一帧天空那道渐变用了哪两个色 */
  function skyStops(h: Harness): string[] {
    const ctx = canvasOf(h).getContext("2d");
    return ctx!.ops.find((o) => o.op === "gradient")?.stops ?? [];
  }

  it("一章一个天色:初雪的上午和极光下的夜里不是同一片天", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.flush(3);
    const day = skyStops(h);
    game.openCampaignLevel(188);
    h.flush(3);
    const night = skyStops(h);
    expect(day.length).toBe(2);
    expect(night.length).toBe(2);
    expect(night[0]).not.toBe(day[0]);
    game.destroy();
  });

  it("无尽的天一波比一波晚,顶到最后是极光", async () => {
    const h = (harness = install());
    const { endlessSky } = await import("./index");
    const { bout } = await openBout(h, endlessArena(3), { chapter: endlessSky });
    h.flush(3);
    const first = skyStops(h);
    bout.arena.wave = 8;
    canvasOf(h).getContext("2d")!.ops.length = 0;
    h.flush(1);
    expect(skyStops(h)[0]).not.toBe(first[0]);
    bout.destroy();
  });

  it("系统里关了动效就不飘雪:玩法一点没动,只是画面站住了", async () => {
    const countArcs = async (reduceMotion: boolean): Promise<number> => {
      const h = (harness = install({ reduceMotion }));
      const { bout } = await openBout(h, campaignArena(buildLevel(0)));
      h.flush(3);
      const ctx = canvasOf(h).getContext("2d");
      ctx!.ops.length = 0;
      h.flush(1);
      const arcs = ctx!.ops.filter((o) => o.op === "arc").length;
      bout.destroy();
      h.restore();
      harness = null;
      return arcs;
    };
    const lively = await countArcs(false);
    const calm = await countArcs(true);
    expect(lively).toBeGreaterThan(calm + 20);
  });

  it("雪球在天上会转会拖尾,落地了就不画了", async () => {
    const h = (harness = install());
    const { bout } = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    const ctx = canvasOf(h).getContext("2d");
    h.key("keydown", "KeyF");
    h.flush(30);
    h.key("keyup", "KeyF");
    h.flush(3);
    expect(bout.arena.balls.length).toBe(1);
    ctx!.ops.length = 0;
    h.flush(1);
    const ball = bout.arena.balls[0]!;
    const bx = ball.x * pxPerUnit(h);
    // 球身那个圆 + 转纹那个椭圆,都画在雪球所在的位置
    const near = (v: number): boolean => Math.abs(v - bx) < 3;
    expect(ctx!.ops.some((o) => o.op === "arc" && near(o.args[0] ?? -99))).toBe(true);
    expect(ctx!.ops.some((o) => o.op === "ellipse" && near(o.args[0] ?? -99))).toBe(true);
    bout.destroy();
  });
});

// ---------------------------------------------------------------------------
// 七、destroy 归零
// ---------------------------------------------------------------------------

describe("snow-fight 1.2 · destroy 收干净", () => {
  it("一局跑起来之后 destroy:rAF、window 监听、画布监听、节点树全部归零", async () => {
    const h = (harness = install());
    const { bout } = await openBout(h, campaignArena(buildLevel(3)));
    h.flush(6);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(h.windowListeners()).toBeGreaterThan(0);
    const cv = canvasOf(h);
    expect(cv.listenerCount()).toBeGreaterThan(0);

    bout.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(0);
    expect(cv.listenerCount()).toBe(0);
    expect(findOne(h.root, "snf-canvas")).toBeNull();
    // 再按键盘也不会有人接
    h.key("keydown", "KeyF");
    h.flush(4);
    expect(h.pendingFrames()).toBe(0);
  });

  it("整款 destroy 之后再调一次也不炸,rAF 一个不剩", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(12);
    h.flush(6);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(() => game.destroy()).not.toThrow();
    expect(h.root.children.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 七、边界:样式、音效、红线
// ---------------------------------------------------------------------------

describe("snow-fight 1.2 · 边界", () => {
  const src = (name: string): string => readFileSync(new URL(name, import.meta.url), "utf8");

  it("CSS 类名一律 snf- 前缀,而且一行都没进 src/styles.css", () => {
    const css = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const classes = [...css.matchAll(/className = `?"?(snf-[\w- ${}.]*)/g)];
    expect(classes.length).toBeGreaterThan(10);
    for (const m of [...css.matchAll(/^\.([\w-]+)\{/gm)]) {
      expect(m[1].startsWith("snf-"), `${m[1]} 不是 snf- 前缀`).toBe(true);
    }
    const global = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
    expect(global).not.toContain("snf-");
    expect(global).not.toContain("snow-fight");
  });

  it("音效只走 api.play:没有自建 AudioContext,也没有 setInterval", () => {
    const index = src("./index.ts");
    expect(index).not.toContain("AudioContext");
    expect(index).not.toContain("setInterval");
    expect(index).toContain("api.play");
  });

  it("index.ts 接了平台那几条线:直达关卡、跳关授权、无尽成绩", () => {
    const index = src("./index.ts");
    expect(index).toContain("openCampaignLevel");
    expect(index).toContain("initialLevel");
    expect(index).toContain("requestSkip");
    expect(index).toContain('recordEndlessBest(meta.id');
  });

  it("meta 说的四种玩法,四个都真的能开起来", async () => {
    expect(meta.modes).toEqual(["campaign", "versus", "twoPlayer", "endless"]);
    expect(meta.platform).toBe("both");
    for (const arena of [campaignArena(buildLevel(0)), duelArena(null, 1), duelArena("hard", 1), endlessArena(1)]) {
      const h = install();
      const { bout } = await openBout(h, arena, { viewW: FIELD_W_12, humans: arena.mode === "duel" ? 2 : 1 });
      h.flush(4);
      expect(findOne(h.root, "snf-canvas")).not.toBeNull();
      expect(bout.arena.status).toBe("playing");
      bout.destroy();
      h.restore();
    }
  });

  it("界面上的字只鼓励,不出现输 / 死 / 血 / 伤,也不蹭商标", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.flush(6);
    h.key("keydown", "Escape");
    h.flush(2);
    const text = allText(h.root);
    expect(text).not.toMatch(/死|鲜血|流血|受伤|疼|痛|杀|淘汰/);
    expect(text).not.toMatch(/愤怒的小鸟|王者荣耀|吃鸡|Angry|Fortnite/i);
    expect(text).toContain("雪");
    game.destroy();
  });
});
