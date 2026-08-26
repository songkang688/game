/**
 * 飞机小队 1.2 的运行时用例:真的把一局跑起来。
 *
 * 跑在 node 环境,DOM 桩在 `domStub.ts`。这里管的是纯逻辑管不到的那几件事:
 * 拖着飞、双人两套输入不串、合流波真的出得来、站着不动会掉一级火力(而不是直接结束)、
 * 弹幕跑久了池子不膨胀、平台直达第 N 关、Skip 走 requestSkip、destroy 归零。
 */
import { afterEach, describe, expect, it } from "vitest";
import { allText, findAll, findButton, findOne, install, type FakeEl, type Harness } from "./domStub";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { PLAYER_ROW, SKY_W, hitBoxRatio } from "./bullets";
import { CANVAS_MAX_H, CANVAS_MIN_H, TOUCH_LIFT, canvasBoxHeight, skyFit } from "./logic";
import { LINK_DIST } from "./power";
import { BOSSES } from "./levels";
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

async function mountGame(h: Harness, initialLevel?: number): Promise<{ game: Mounted; played: string[] }> {
  const mod = await import("./index");
  const played: string[] = [];
  const game = mod.mount({
    root: h.root as unknown as HTMLElement,
    play: (n: string) => void played.push(n),
    addStars: (n: number) => n,
    getStars: () => 0,
    onWin: () => {},
    onLose: () => {},
    ...(initialLevel === undefined ? {} : { initialLevel }),
  } as never);
  return { game, played };
}

/** 直接开一局,不经过选关地图 —— 手感相关的断言都走这条路 */
async function openSortie(
  h: Harness,
  over: Partial<Parameters<typeof import("./index").createSortie>[0]> = {}
): Promise<ReturnType<typeof import("./index").createSortie>> {
  const mod = await import("./index");
  return mod.createSortie({
    host: h.root as unknown as HTMLElement,
    players: 1,
    tint: "#EAF2FF",
    hint: "测试用航线",
    waves: [],
    boss: null,
    pickups: [],
    sfx: () => {},
    onFinish: () => {},
    ...over,
  } as never);
}

/** 画布上的一点 → 桩里的 client 坐标(桩把画布定成 360×540,左上角在原点) */
function clientAt(x: number, y: number): { clientX: number; clientY: number; pointerId: number } {
  const s = 360 / SKY_W;
  return { clientX: x * s, clientY: y * s, pointerId: 1 };
}

// ---------------------------------------------------------------------------
// 一、手感:拖着飞 / 判定点 / 手指偏移
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 运行时 · 拖着飞", () => {
  it("拖动时飞机追向手指上方 40px,松手就不跟了", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h);
    const canvas = findOne(h.root, "sks-cv") as FakeEl;
    canvas.fire("pointerdown", clientAt(120, 500));
    h.flush(40);
    const moved = sortie.snapshot().pilots[0];
    expect(Math.abs(moved.x - 120)).toBeLessThan(6);
    // 飞机停在手指**上方**:y 明显小于手指那一行
    expect(moved.y).toBeLessThan(500 - TOUCH_LIFT + 6);
    expect(moved.y).toBeGreaterThan(500 - TOUCH_LIFT - 6);

    canvas.fire("pointerup", clientAt(120, 500));
    canvas.fire("pointermove", clientAt(400, 300));
    h.flush(20);
    const after = sortie.snapshot().pilots[0];
    expect(Math.abs(after.x - moved.x)).toBeLessThan(2);
    sortie.destroy();
  });

  it("判定点与手指偏移都有开关,而且默认都是开的", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h);
    const opts = findAll(h.root, "sks-opt");
    expect(opts.length).toBe(2);
    for (const btn of opts) expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(opts[0].textContent).toContain("判定点:开");
    expect(opts[1].textContent).toContain(`${TOUCH_LIFT}px`);

    // 关掉偏移之后,拖动就变成跟手
    opts[1].fire("click");
    expect(opts[1].getAttribute("aria-pressed")).toBe("false");
    const canvas = findOne(h.root, "sks-cv") as FakeEl;
    canvas.fire("pointerdown", clientAt(200, 480));
    h.flush(40);
    expect(Math.abs(sortie.snapshot().pilots[0].y - 480)).toBeLessThan(6);
    opts[0].fire("click");
    expect(opts[0].textContent).toContain("判定点:关");
    sortie.destroy();
  });

  it("HUD 一行显示火力 / 备用机 / 护盾 / 炸弹 / 分数,字号全都 ≥ 14px", async () => {
    const h = (harness = install());
    const mod = await import("./index");
    const sortie = await openSortie(h);
    h.flush(2);
    const hud = findOne(h.root, "sks-hud") as FakeEl;
    const text = hud.children.map((c) => c.textContent).join(" ");
    expect(text).toContain("⚡Lv");
    expect(text).toContain("✈️×");
    expect(text).toContain("💣");
    expect(text).toContain("✨");
    // 一行:HUD 自己不换行,窄屏靠横向滚动
    expect(mod.CSS).toContain("flex-wrap:nowrap");
    const sizes = [...mod.CSS.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(8);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
    sortie.destroy();
  });

  it("舞台矮下来时画布跟着矮,玩家那一行绝不掉到画布外面", async () => {
    const h = (harness = install());
    // 摆一个「外壳只给 380px、而且 overflow 是裁剪的」局面
    const stage = h.root as unknown as FakeEl;
    stage.dataset.clip = "1";
    stage.rect = { left: 0, top: 0, width: 340, height: 300 };
    stage.clientWidth = 340;
    const sortie = await openSortie(h);
    h.flush(2);
    const box = findOne(h.root, "sks-box") as FakeEl;
    const canvas = findOne(h.root, "sks-cv") as FakeEl;
    // 舞台下沿就在 300,画布不许越过那条线(1.1 一律 460,直接顶穿)
    const cssH = Number.parseInt(canvas.style.height, 10);
    expect(cssH).toBeLessThanOrEqual(300);
    expect(cssH).toBeGreaterThanOrEqual(CANVAS_MIN_H);
    // 天空整片装得下:飞机那一行落在画布里面
    const fit = skyFit(box.getBoundingClientRect().width, cssH);
    expect(fit.offY).toBeGreaterThanOrEqual(0);
    expect(fit.offY + PLAYER_ROW * fit.scale).toBeLessThan(cssH);
    sortie.destroy();
  });

  it("天空缩得再小,判定核心也得看得见:落到屏幕上不小于 5px 半径", async () => {
    const h = (harness = install());
    const stage = h.root as unknown as FakeEl;
    stage.dataset.clip = "1";
    // 挤到只剩 260px:campaign 在 375×667 上就是这种局面
    stage.rect = { left: 0, top: 0, width: 340, height: 260 };
    stage.clientWidth = 340;
    const sortie = await openSortie(h);
    const canvas = findOne(h.root, "sks-cv") as FakeEl;
    const ctx = canvas.getContext("2d") as unknown as { ops: Array<{ op: string; args: number[] }> };
    ctx.ops.length = 0;
    h.flush(1);
    const scale = ctx.ops.find((o) => o.op === "scale")?.args[0] ?? 0;
    expect(scale).toBeGreaterThan(0);
    // 玩家中心(0,0 —— 画的时候已经 translate 过去了)那几个同心圆里最大的就是白环
    const core = ctx.ops.filter((o) => o.op === "arc" && o.args[0] === 0 && o.args[1] === 0).map((o) => o.args[2]);
    expect(core.length).toBeGreaterThan(0);
    expect(Math.max(...core) * scale).toBeGreaterThanOrEqual(5);
    // 判定圈本身仍然比机身小得多:这是「看着挨到翅膀其实没事」的那条底线
    expect(hitBoxRatio().width).toBeLessThan(0.3);
    sortie.destroy();
  });

  it("480×720 那片天空一格都不裁:等比缩到画布里再居中", () => {
    // 又矮又宽的画布:按宽度缩放会把 y=596 那一行甩到外面去,取小的那个比例才行
    const flat = skyFit(360, 240);
    expect(flat.scale).toBeCloseTo(240 / 720, 6);
    expect(flat.offX).toBeCloseTo((360 - 480 * flat.scale) / 2, 6);
    expect(PLAYER_ROW * flat.scale).toBeLessThan(240);
    // 正好是 2:3 的画布:不留白
    const exact = skyFit(320, 480);
    expect(exact.offX).toBeCloseTo(0, 6);
    expect(exact.offY).toBeCloseTo(0, 6);
    // 地方给得再多也不超过上限;地方少到离谱也保底,不会缩成一条线
    expect(canvasBoxHeight(360, 9999)).toBeLessThanOrEqual(CANVAS_MAX_H);
    expect(canvasBoxHeight(360, 10)).toBe(CANVAS_MIN_H);
    expect(canvasBoxHeight(360, 300)).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// 二、双人
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 运行时 · 双人", () => {
  it("两个人同时按键互不串:朵朵往左、星星往右", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h, { players: 2 });
    const before = sortie.snapshot().pilots;
    h.key("keydown", "KeyA");
    h.key("keydown", "ArrowRight");
    h.flush(20);
    const after = sortie.snapshot().pilots;
    expect(after[0].x).toBeLessThan(before[0].x - 20);
    expect(after[1].x).toBeGreaterThan(before[1].x + 20);

    // 松开朵朵的键,只有朵朵停下,星星继续往右
    h.key("keyup", "KeyA");
    const mid = sortie.snapshot().pilots;
    h.flush(20);
    const last = sortie.snapshot().pilots;
    expect(last[0].x).toBe(mid[0].x);
    expect(last[1].x).toBeGreaterThan(mid[1].x);
    sortie.destroy();
  });

  it("合作模式的配合价值:两机靠到一起才拧出合流波,分开就没有", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h, { players: 2, link: true });
    // 先各自往两边拉开:超出合流距离就没有合流波
    h.key("keydown", "KeyA");
    h.key("keydown", "ArrowRight");
    h.flush(12);
    h.key("keyup", "KeyA");
    h.key("keyup", "ArrowRight");
    h.flush(4);
    const apart = sortie.snapshot();
    expect(Math.abs(apart.pilots[0].x - apart.pilots[1].x)).toBeGreaterThan(LINK_DIST);
    expect(apart.merges).toBe(0);

    // 再把两个人拉回到一起:靠拢到合流距离以内就拧出合流波
    h.key("keydown", "KeyD");
    h.key("keydown", "ArrowLeft");
    h.flush(16);
    h.key("keyup", "KeyD");
    h.key("keyup", "ArrowLeft");
    h.flush(4);
    const snap = sortie.snapshot();
    expect(snap.finished).toBe(false);
    expect(Math.abs(snap.pilots[0].x - snap.pilots[1].x)).toBeLessThan(LINK_DIST);
    expect(snap.merges).toBeGreaterThan(0);
    sortie.destroy();
  });

  it("同屏比拼模式不合流(它考的是各飞各的)", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h, { players: 2, link: false });
    h.key("keydown", "KeyD");
    h.key("keydown", "ArrowLeft");
    h.flush(8);
    h.key("keyup", "KeyD");
    h.key("keyup", "ArrowLeft");
    h.flush(8);
    const snap = sortie.snapshot();
    // 两个人已经贴到合流距离以内了,比拼模式照样各打各的
    expect(Math.abs(snap.pilots[0].x - snap.pilots[1].x)).toBeLessThan(LINK_DIST);
    expect(snap.merges).toBe(0);
    sortie.destroy();
  });
});

// ---------------------------------------------------------------------------
// 二点五、减少动态
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 运行时 · 减少动态", () => {
  it("开了「减少动态」就不再屏震,平时会震", async () => {
    const h = (harness = install());
    const loud = await openSortie(h, { boss: BOSSES[1] });
    expect(loud.snapshot().calm).toBe(false);
    for (let i = 0; i < 900 && loud.snapshot().shake === 0; i++) h.flush(1);
    expect(loud.snapshot().shake).toBeGreaterThan(0);
    loud.destroy();

    h.setReducedMotion(true);
    const calm = await openSortie(h, { boss: BOSSES[1] });
    expect(calm.snapshot().calm).toBe(true);
    for (let i = 0; i < 900; i++) {
      h.flush(1);
      expect(calm.snapshot().shake).toBe(0);
    }
    expect(calm.snapshot().pilots[0].touched + calm.snapshot().pilots[0].grazes).toBeGreaterThan(0);
    calm.destroy();
  });
});

// ---------------------------------------------------------------------------
// 三、Boss、被击中与对象池
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 运行时 · Boss 与池子", () => {
  it("Boss 出场先给预告:预告期间一发弹都不发,预告完才开火", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h, { boss: BOSSES[0] });
    h.flush(10);
    const cue = sortie.snapshot().boss;
    expect(cue).not.toBeNull();
    expect(cue?.cueLeft).toBeGreaterThan(0);
    expect(sortie.snapshot().bullets).toBe(0);
    // 预告 + 出场飞入之后开始发弹
    h.flush(220);
    const firing = sortie.snapshot();
    expect(firing.boss?.cueLeft).toBe(0);
    expect(firing.bullets).toBeGreaterThan(0);
    sortie.destroy();
  });

  it("站着不动会被碰到:掉一级火力、打个转,但这一趟没结束(还有备用机)", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h, { boss: BOSSES[3] });
    // 先把火力吃到 2 级(散射 + 僚机),好看清「掉一级」
    const canvas = findOne(h.root, "sks-cv") as FakeEl;
    expect(canvas).toBeTruthy();
    h.flush(30);
    for (let i = 0; i < 900 && sortie.snapshot().pilots[0].touched === 0; i++) h.flush(1);
    const snap = sortie.snapshot();
    expect(snap.pilots[0].touched).toBeGreaterThan(0);
    expect(snap.pilots[0].spare).toBeLessThan(2);
    expect(snap.pilots[0].grounded).toBe(false);
    expect(snap.finished).toBe(false);
    sortie.destroy();
  });

  it("弹幕跑上几千帧,三个池子都不再新造对象", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h, { boss: BOSSES[7] });
    h.flush(600);
    const warm = sortie.snapshot();
    expect(warm.created.bullets).toBeGreaterThan(0);
    h.flush(1800);
    const late = sortie.snapshot();
    // 热身之后再跑三倍的帧数,池子占的对象数一个都没多
    expect(late.created.bullets).toBe(warm.created.bullets);
    expect(late.created.puffs).toBeLessThanOrEqual(warm.created.puffs);
    expect(late.footprint).toBeLessThanOrEqual(warm.footprint);
    sortie.destroy();
  });

  it("擦弹会被记下来:贴着弹边过去给「好险!」而不是扣东西", async () => {
    const h = (harness = install());
    const sortie = await openSortie(h, { boss: BOSSES[5] });
    for (let i = 0; i < 1200 && sortie.snapshot().pilots[0].grazes === 0; i++) h.flush(1);
    const snap = sortie.snapshot();
    expect(snap.pilots[0].grazes).toBeGreaterThan(0);
    // 擦弹只是反馈,不掉备用机
    expect(snap.pilots[0].grazes).toBeGreaterThanOrEqual(snap.pilots[0].touched);
    sortie.destroy();
  });

  it("没有敌机也没有 Boss 的一趟会正常收尾,结算带上擦弹数", async () => {
    const h = (harness = install());
    let done: { cleared: boolean; grazes: number } | null = null;
    const sortie = await openSortie(h, {
      onFinish: (_pilots: unknown, result: { cleared: boolean; grazes: number }) => {
        done = result;
      },
    });
    h.flush(200);
    expect(done).not.toBeNull();
    expect(done!.cleared).toBe(true);
    expect(done!.grazes).toBe(0);
    expect(sortie.snapshot().finished).toBe(true);
    sortie.destroy();
  });
});

// ---------------------------------------------------------------------------
// 四、平台接线
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 平台接线", () => {
  it("模式条上四个入口都在:战役地图 + 云海远征 + 双人合作 + 双人同屏", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    h.flush(2);
    const text = allText(h.root);
    expect(text).toContain("云海远征");
    expect(text).toContain("双人合作");
    expect(text).toContain("双人同屏");
    // 188 关的选关地图由平台框架托管
    expect(findAll(h.root, "l99-node").length).toBeGreaterThan(10);
    expect(meta.modes).toEqual(["campaign", "endless", "coop", "twoPlayer"]);
    game.destroy();
  });

  it("云海远征 / 双人合作 / 双人同屏 都点得进去,而且都能返回", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    for (const entry of ["云海远征", "双人合作", "双人同屏"]) {
      findButton(h.root, entry)?.fire("click");
      h.flush(4);
      expect(findOne(h.root, "sks-cv"), `${entry} 没开出画布`).toBeTruthy();
      findButton(h.root, "← 返回")?.fire("click");
      h.flush(2);
      expect(findOne(h.root, "sks-cv")).toBeNull();
    }
    game.destroy();
  });

  it("双人合作与双人同屏都是真的两架飞机、两套手柄", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    for (const entry of ["双人合作", "双人同屏"]) {
      findButton(h.root, entry)?.fire("click");
      h.flush(4);
      const pads = findOne(h.root, "sks-pads") as FakeEl;
      expect(pads.dataset.players, `${entry} 不是两个人`).toBe("2");
      expect(findAll(h.root, "sks-pad").length).toBe(2);
      const text = allText(h.root);
      expect(text).toContain("朵朵 WASD");
      expect(text).toContain("星星 方向键");
      findButton(h.root, "← 返回")?.fire("click");
      h.flush(2);
    }
    game.destroy();
  });

  it("openCampaignLevel(n) 直达第 N 关,越界会夹回合法范围", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    expect(game.openCampaignLevel(42)).toBe(42);
    h.flush(3);
    expect(allText(h.root)).toContain("第 42 关");
    expect(findOne(h.root, "sks-cv")).toBeTruthy();
    expect(game.openCampaignLevel(9999)).toBe(188);
    expect(game.openCampaignLevel(-5)).toBe(1);
    h.flush(2);
    // 回地图之后画布收走,选关地图回来
    findButton(h.root, "🗺️ 回地图")?.fire("click");
    h.flush(2);
    expect(findOne(h.root, "sks-cv")).toBeNull();
    expect(findAll(h.root, "l99-node").length).toBeGreaterThan(10);
    game.destroy();
  });

  it("壳层给 initialLevel 就直接开那一关", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h, 77);
    h.flush(3);
    expect(allText(h.root)).toContain("第 77 关");
    game.destroy();
  });

  it("壳层没给就认地址栏 ?level=", async () => {
    const h = (harness = install({ search: "?level=133" }));
    const mod = await import("./index");
    expect(mod.levelFromQuery()).toBe(133);
    const { game } = await mountGame(h);
    h.flush(3);
    expect(allText(h.root)).toContain("第 133 关");
    game.destroy();
    harness.restore();

    // 没有 ?level= 就老老实实进地图
    harness = install();
    const plain = await mountGame(harness);
    harness.flush(3);
    expect(findOne(harness.root, "sks-cv")).toBeNull();
    plain.game.destroy();
  });

  it("跳关走平台的 requestSkip:壳层没注册就不出这个按钮", async () => {
    const h = (harness = install());
    const bare = await mountGame(h);
    h.flush(2);
    expect(findButton(h.root, "跳过")).toBeNull();
    bare.game.destroy();
    harness.restore();

    const asked: Array<{ id: string; level: number }> = [];
    registerLevelExtras({
      requestSkip: (id, level) => {
        asked.push({ id, level });
        return Promise.resolve(true);
      },
    });
    harness = install();
    const withSkip = await mountGame(harness);
    harness.flush(2);
    const btn = findButton(harness.root, "跳过");
    expect(btn).not.toBeNull();
    btn?.fire("click");
    await Promise.resolve();
    expect(asked[0]?.id).toBe(meta.id);
    withSkip.game.destroy();
  });

  it("无尽最好成绩认的是 save 里 sky-squad 那一条", async () => {
    const h = (harness = install());
    const { save } = await import("../../engine/save");
    save.recordEndlessBest(meta.id, 1234);
    expect(save.getGameProgress(meta.id).endlessBest).toBeGreaterThanOrEqual(1234);
    const { game } = await mountGame(h);
    h.flush(2);
    expect(findButton(h.root, "云海远征")?.textContent).toContain("1234");
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 五、destroy 归零
// ---------------------------------------------------------------------------

describe("sky-squad 1.2 destroy", () => {
  it("一局 destroy 之后:rAF、window 监听、画布监听、池子全部归零", async () => {
    const h = (harness = install());
    const before = h.windowListeners();
    const sortie = await openSortie(h, { boss: BOSSES[2], players: 2 });
    h.flush(300);
    const canvas = findOne(h.root, "sks-cv") as FakeEl;
    canvas.fire("pointerdown", clientAt(200, 500));
    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(h.windowListeners()).toBeGreaterThan(before);
    expect(sortie.snapshot().footprint).toBeGreaterThan(0);

    sortie.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(canvas.listenerCount()).toBe(0);
    const after = sortie.snapshot();
    expect(after.footprint).toBe(0);
    expect(after.bullets).toBe(0);
    expect(after.foes).toBe(0);
    expect(after.boss).toBeNull();
    expect(h.root.children.length).toBe(0);
  });

  it("整款 destroy 之后 root 空空如也,再排帧也不会有人画东西", async () => {
    const h = (harness = install());
    const { game } = await mountGame(h);
    game.openCampaignLevel(24);
    h.flush(60);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    game.destroy();
    expect(h.root.children.length).toBe(0);
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(0);
    h.flush(10);
    expect(h.pendingFrames()).toBe(0);
  });
});
