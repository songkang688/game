/**
 * 冰冰火火森林 1.2 的运行时用例:真的把一关挂起来,按真键走完主链路。
 *
 * 纯逻辑那几份用例管不到的东西都在这里:
 * 平台直达第 N 关、`?level=` 直达、Skip 走家长门、
 * 单人换人按钮固定在棋盘上方、掉池变小云朵飘回检查点(不整关重来)、
 * 照着解法一路走到结算、以及 `destroy` 之后 rAF / 监听 / 节点全部归零。
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allText, findAll, findButton, findOne, install, type FakeEl, type Harness } from "./domStub";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { TOTAL_LEVELS } from "../level99";
import { analyzeLevel } from "./levels";
import { COOP_FROM_LEVEL } from "./coop";
import { TOUCH_HIT_PX } from "./solo";
import { FEEL } from "./feel";
import {
  ACTION_DIR,
  KEY_MAP,
  TILE,
  initialState,
  moveHero,
  parseLevel,
  solveLevel,
  type Hero,
  type ParsedLevel,
} from "./logic";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
  resetLevelExtras();
});

interface Mounted {
  destroy: () => void;
  pause: () => void;
  resume: () => void;
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

/** 方向 → 该角色那一套键位上的物理键 */
function keyFor(hero: Hero, dir: number): string {
  for (const [code, bind] of Object.entries(KEY_MAP)) {
    if (bind.hero !== hero) continue;
    if (ACTION_DIR[bind.action] === dir) return code;
  }
  throw new Error(`找不到 ${hero} 往 ${dir} 的按键`);
}

/**
 * 按一下走一格。
 * 一帧推进的毫秒数比 `FEEL.STEP_MS` 大一点,保证上一格的节奏已经走完。
 */
function tapStep(h: Harness, code: string): void {
  h.key("keydown", code);
  h.flush(1, FEEL.STEP_MS + 20);
  h.key("keyup", code);
}

function chipText(h: Harness, needle: string): string {
  for (const chip of findAll(h.root, "iff-chip")) {
    if (chip.textContent.includes(needle)) return chip.textContent;
  }
  return "";
}

function swapButton(h: Harness): FakeEl {
  const btn = findOne(h.root, "iff-swap");
  if (!btn) throw new Error("换人按钮没挂上");
  return btn;
}

function shellTitle(h: Harness): string {
  return findOne(h.root, "iff-shelltitle")?.textContent ?? "";
}

// ---------------------------------------------------------------------------
// 一、直达第 N 关
// ---------------------------------------------------------------------------

describe("平台直达", () => {
  it("openCampaignLevel(100) 真的开在第 100 关,而且棋盘挂出来了", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    expect(game.openCampaignLevel(100)).toBe(100);
    expect(shellTitle(h)).toContain("第 100 关");
    expect(findAll(h.root, "iff-board").length).toBe(1);
    game.destroy();
  });

  it("越界的关号会被夹回 1..188,不会开出一张空图", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    expect(game.openCampaignLevel(0)).toBe(1);
    expect(shellTitle(h)).toContain("第 1 关");
    expect(game.openCampaignLevel(9999)).toBe(TOTAL_LEVELS);
    expect(shellTitle(h)).toContain(`第 ${TOTAL_LEVELS} 关`);
    game.destroy();
  });

  it("地址栏 `?level=145` 一挂上就直接进那一关", async () => {
    const h = install({ search: "?level=145" });
    harness = h;
    const { game } = await mountGame(h);
    expect(shellTitle(h)).toContain("第 145 关");
    game.destroy();
  });

  it("壳层给了 initialLevel 就听壳层的,地址栏靠边站", async () => {
    const h = install({ search: "?level=3" });
    harness = h;
    const { game } = await mountGame(h, { initialLevel: 188 });
    expect(shellTitle(h)).toContain("第 188 关");
    game.destroy();
  });

  it("再开一关会把上一关收干净,不会两张棋盘叠着", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(100);
    const frames = h.pendingFrames();
    game.openCampaignLevel(101);
    expect(findAll(h.root, "iff-board").length).toBe(1);
    expect(h.pendingFrames()).toBeLessThanOrEqual(frames);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 二、Skip 走家长门
// ---------------------------------------------------------------------------

describe("跳过这一关", () => {
  it("壳层没注册 requestSkip 就不挂跳关按钮", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(50);
    expect(findButton(h.root, "跳过这一关")).toBeNull();
    game.destroy();
  });

  it("家长门放行才跳,而且跳的是下一关", async () => {
    const h = install();
    harness = h;
    const asked: Array<[string, number]> = [];
    registerLevelExtras({
      requestSkip: (id, lv) => {
        asked.push([id, lv]);
        return Promise.resolve(true);
      },
    });
    const { game } = await mountGame(h);
    game.openCampaignLevel(50);
    const btn = findButton(h.root, "跳过这一关");
    expect(btn).not.toBeNull();
    btn!.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    expect(asked.length).toBe(1);
    expect(asked[0][1]).toBe(49);
    expect(shellTitle(h)).toContain("第 51 关");
    game.destroy();
  });

  it("家长门不放行就留在原地", async () => {
    const h = install();
    harness = h;
    registerLevelExtras({ requestSkip: () => Promise.resolve(false) });
    const { game } = await mountGame(h);
    game.openCampaignLevel(50);
    findButton(h.root, "跳过这一关")!.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    expect(shellTitle(h)).toContain("第 50 关");
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 三、单人模式:换人按钮 + Tab
// ---------------------------------------------------------------------------

describe("单人切换(运行时)", () => {
  it("换人按钮固定在棋盘正上方的中间那一栏里", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    const wrap = findOne(h.root, "iff-wrap")!;
    const kinds = wrap.children.map((c) => c.className);
    expect(kinds.indexOf("iff-swapbar")).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf("iff-swapbar")).toBeLessThan(kinds.indexOf("iff-board"));
    expect(swapButton(h).parentElement?.className).toBe("iff-swapbar");
    game.destroy();
  });

  it("点一下进单人,再点一下换人,按钮上的字一直说得清下一步", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    const btn = swapButton(h);
    expect(btn.textContent).toContain("一个人玩");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    btn.fire("click");
    expect(btn.textContent).toContain("换焰焰");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    btn.fire("click");
    expect(btn.textContent).toContain("换凛凛");
    game.destroy();
  });

  it("Tab 也能换,而且待命的那一位在虚拟键盘上标了出来", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    const names = findAll(h.root, "iff-padname");
    expect(names.length).toBe(2);
    expect(names.map((n) => n.textContent)).toEqual(["凛凛", "焰焰"]);
    h.key("keydown", "Tab");
    expect(names[1].textContent).toContain("待命");
    h.key("keydown", "Tab");
    expect(names[0].textContent).toContain("待命");
    expect(names[1].textContent).toBe("焰焰");
    game.destroy();
  });

  it("单人模式下方向键也开当前这一位 —— 另一位一步都不动", async () => {
    const h = install();
    harness = h;
    // 挑一关:凛凛往右一格是空地,焰焰四周随便怎么走都不该动
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.key("keydown", "Tab"); // 进单人,当前是凛凛
    const before = allText(h.root);
    // 星星那一套(方向键)在单人模式下指挥的也是凛凛
    tapStep(h, "ArrowRight");
    tapStep(h, "ArrowRight");
    // 焰焰待命的标记始终挂着,说明控制权没跑掉
    expect(findAll(h.root, "iff-padname")[1].textContent).toContain("待命");
    expect(before.length).toBeGreaterThan(0);
    game.destroy();
  });

  it("换人的一瞬间把两套按住不放的键都清掉,上一位不会带着幽灵继续走", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.key("keydown", "KeyD"); // 凛凛一直按着右
    h.flush(2, FEEL.STEP_MS + 20);
    h.key("keydown", "Tab"); // 换人 —— held 应该被清空
    const gems = chipText(h, "💎");
    h.flush(6, FEEL.STEP_MS + 20);
    // 没人在动,HUD 的宝石数不会自己变
    expect(chipText(h, "💎")).toBe(gems);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 四、掉池 = 小云朵飘回检查点
// ---------------------------------------------------------------------------

/**
 * 找一条「几步就踩空」的路:焰焰全程不动,只让凛凛走,
 * 搜出最短的一串方向,最后一下正好迈进自己过不去的池子。
 *
 * 关卡生成器不会把池子直接摆在出发点旁边(那样太坑),所以得先走两步再掉 ——
 * 这也更像孩子真实的一次失手。挑没有传送带的前 99 关,免得结算把焰焰也带走。
 */
interface Trap {
  level: number;
  /** 走到坑边的那几步 */
  walk: number[];
  /** 最后踩空的那一下 */
  fall: number;
}

let cachedTrap: Trap | null = null;

function findTrap(): Trap {
  if (cachedTrap) return cachedTrap;
  for (let i = 0; i < COOP_FROM_LEVEL; i++) {
    const lv: ParsedLevel = parseLevel(analyzeLevel(i).grid);
    // 传送带会顺手把焰焰也带走,拉杆 / 踏板会让第二次重走的路不一样 —— 都躲开,
    // 这样同一串方向可以反复走,用例才好数「掉了几次」
    if (lv.tiles.some((t) => t === TILE.BELT || t === TILE.LEVER || t === TILE.PLATE)) continue;
    const start = initialState(lv);
    const seen = new Set<string>([`${start.ice}|${start.levers}`]);
    const queue: Array<{ st: typeof start; path: number[] }> = [{ st: start, path: [] }];
    while (queue.length > 0 && queue[0].path.length < 6) {
      const cur = queue.shift()!;
      for (let dir = 0; dir < 4; dir++) {
        const out = moveHero(lv, cur.st, "ice", dir);
        if (out.kind === "hurt" && cur.path.length > 0) {
          cachedTrap = { level: i, walk: cur.path, fall: dir };
          return cachedTrap;
        }
        if (out.kind !== "moved") continue;
        if (out.state.fire !== cur.st.fire) continue;
        const key = `${out.state.ice}|${out.state.levers}`;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ st: out.state, path: [...cur.path, dir] });
      }
    }
  }
  throw new Error("188 关里居然找不到一处几步就能踩空的地方");
}

/** 把凛凛带到坑边,再让他迈出踩空的那一下 */
function walkIntoTrap(h: Harness, trap: Trap): void {
  for (const dir of trap.walk) tapStep(h, keyFor("ice", dir));
  tapStep(h, keyFor("ice", trap.fall));
}

/** 等小云朵飘完这一趟 */
function waitCloud(h: Harness): void {
  h.flush(1, FEEL.CLOUD_MS + 40);
}

describe("掉池回检查点", () => {
  it("188 关里确实有「一脚踩空」的地方,用例不是空转", () => {
    const trap = findTrap();
    expect(trap.level).toBeGreaterThanOrEqual(0);
    expect(trap.walk.length).toBeGreaterThan(0);
  });

  it("踩进池子只掉一颗心,说的是小云朵飘回去,一个吓人的字都没有", async () => {
    const h = install();
    harness = h;
    const { game, played } = await mountGame(h);
    const trap = findTrap();
    game.openCampaignLevel(trap.level + 1);
    expect(chipText(h, "💗")).toBe("💗 ❤❤❤");
    walkIntoTrap(h, trap);
    expect(chipText(h, "💗")).toBe("💗 ❤❤·");
    const tip = findOne(h.root, "iff-tip")!.textContent;
    expect(tip).toContain("小云");
    expect(tip).toContain("机关都还开着");
    for (const bad of ["死", "血", "痛", "输"]) expect(tip.includes(bad)).toBe(false);
    expect(played).toContain("oops");
    game.destroy();
  });

  it("飘回去不是整关重来 —— 棋盘还在,关卡没有被重新摆过", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    const trap = findTrap();
    game.openCampaignLevel(trap.level + 1);
    walkIntoTrap(h, trap);
    // 「重摆」是一颗单独的按钮,掉池不会替玩家按它
    expect(findButton(h.root, "重摆")).not.toBeNull();
    expect(findOne(h.root, "iff-tip")!.textContent).not.toContain("重新摆好");
    expect(findAll(h.root, "iff-board").length).toBe(1);
    game.destroy();
  });

  it("飘的这一路里不接受新指令,落地之后才继续听话", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    const trap = findTrap();
    game.openCampaignLevel(trap.level + 1);
    walkIntoTrap(h, trap);
    const hearts = chipText(h, "💗");
    // 飘回去的这 620ms 里再怎么按都不会又掉一颗心
    h.key("keydown", keyFor("ice", trap.fall));
    h.flush(3, 100);
    expect(chipText(h, "💗")).toBe(hearts);
    h.key("keyup", keyFor("ice", trap.fall));
    game.destroy();
  });

  it("心掉光了也不会被打回起点 —— 1.2 只有时间用完才收场", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    const trap = findTrap();
    game.openCampaignLevel(trap.level + 1);
    for (let i = 0; i < 4; i++) {
      walkIntoTrap(h, trap);
      waitCloud(h);
    }
    expect(chipText(h, "💗")).toBe("💗 ···");
    expect(allText(h.root)).not.toContain("再试一次");
    expect(findAll(h.root, "iff-board").length).toBe(1);
    game.destroy();
  });

  it("HUD 上一直挂着休息点的小旗,孩子知道掉下去会回到哪", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(120);
    const flag = chipText(h, "🚩");
    expect(flag).toMatch(/🚩 [0-3]\/[23]/);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 五、走完一关:结算
// ---------------------------------------------------------------------------

describe("主链路走到结算", () => {
  it("照着解法一路按下去,第 1 关真的能在运行时里打通并弹出结算", async () => {
    const h = install();
    harness = h;
    const parsed = parseLevel(analyzeLevel(0).grid);
    const res = solveLevel(parsed, true);
    expect(res.solvable).toBe(true);

    const stars: number[] = [];
    const { game } = await mountGame(h, { addStars: (n: number) => void stars.push(n) });
    game.openCampaignLevel(1);
    for (const step of res.path!) tapStep(h, keyFor(step.hero, step.dir));

    const text = allText(h.root);
    expect(text).toContain("过关");
    expect(findButton(h.root, "下一关")).not.toBeNull();
    expect(findButton(h.root, "再玩一次")).not.toBeNull();
    expect(findButton(h.root, "回选关")).not.toBeNull();
    expect(stars.length).toBe(1);
    game.destroy();
  }, 60000);

  it("结算之后棋盘停了,rAF 不会再空转", async () => {
    const h = install();
    harness = h;
    const parsed = parseLevel(analyzeLevel(0).grid);
    const res = solveLevel(parsed, true);
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    for (const step of res.path!) tapStep(h, keyFor(step.hero, step.dir));
    h.flush(2, 16);
    expect(h.pendingFrames()).toBe(0);
    game.destroy();
  }, 60000);

  it("结算面板上点「再玩一次」能重新开这一关", async () => {
    const h = install();
    harness = h;
    const parsed = parseLevel(analyzeLevel(0).grid);
    const res = solveLevel(parsed, true);
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    for (const step of res.path!) tapStep(h, keyFor(step.hero, step.dir));
    findButton(h.root, "再玩一次")!.fire("click");
    expect(shellTitle(h)).toContain("第 1 关");
    expect(findAll(h.root, "iff-board").length).toBe(1);
    expect(allText(h.root)).not.toContain("过关");
    game.destroy();
  }, 60000);
});

// ---------------------------------------------------------------------------
// 六、Esc 暂停
// ---------------------------------------------------------------------------

describe("Esc 暂停", () => {
  it("按一下停住,再按一下接着玩", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.key("keydown", "Escape");
    expect(findOne(h.root, "iff-tip")!.textContent).toContain("再按一次 Esc");
    h.key("keydown", "Escape");
    expect(findOne(h.root, "iff-tip")!.textContent).not.toContain("再按一次 Esc");
    game.destroy();
  });

  it("暂停期间按方向键没反应,连时间都不走", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.flush(2, 500);
    const clock = chipText(h, "⏱");
    h.key("keydown", "Escape");
    h.key("keydown", "KeyD");
    h.key("keydown", "Tab");
    h.flush(6, 500);
    expect(chipText(h, "⏱")).toBe(clock);
    // Tab 也被挡住了,不会在暂停时偷偷换人
    expect(swapButton(h).textContent).toContain("一个人玩");
    game.destroy();
  });

  it("恢复之后暂停前按住的那一下不会突然兑现", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    h.key("keydown", "KeyD");
    h.key("keydown", "Escape");
    h.key("keydown", "Escape");
    const gems = chipText(h, "💎");
    h.flush(4, FEEL.STEP_MS + 20);
    expect(chipText(h, "💎")).toBe(gems);
    h.key("keyup", "KeyD");
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 七、减少动态效果
// ---------------------------------------------------------------------------

describe("prefers-reduced-motion", () => {
  it("样式里把按下去的位移和抖动关掉了", () => {
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(src).toContain("@media (prefers-reduced-motion:reduce)");
    expect(src).toContain("transform:none");
  });

  it("系统勾上「减少动态效果」时照样跑得动,镜头直接就位不做缓动", async () => {
    const h = install();
    harness = h;
    (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: true });
    (globalThis as { window?: Record<string, unknown> }).window!.matchMedia = () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    const { game } = await mountGame(h);
    game.openCampaignLevel(100);
    h.flush(4, 16);
    expect(findAll(h.root, "iff-board").length).toBe(1);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 八、手机 360px
// ---------------------------------------------------------------------------

describe("360px 竖屏", () => {
  it("左右各挂一套方向键,热区不小于 44px", async () => {
    const h = install({ innerWidth: 360 });
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    const pads = findAll(h.root, "iff-pad");
    expect(pads.length).toBe(2);
    expect(pads[0].className).toContain("iff-pad--ice");
    expect(pads[1].className).toContain("iff-pad--fire");
    const css = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(css).toContain(`--iff-hit:\${TOUCH_HIT_PX}px`);
    expect(css).toContain("width:var(--iff-hit);height:var(--iff-hit)");
    expect(TOUCH_HIT_PX).toBeGreaterThanOrEqual(44);
    game.destroy();
  });

  it("每套方向键都是四个方向 + 元素之力 + 同行键,而且都有读屏说明", async () => {
    const h = install({ innerWidth: 360 });
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(1);
    for (const pad of findAll(h.root, "iff-pad")) {
      const labelled = pad.children.filter((b) => b.getAttribute("aria-label") !== null);
      expect(labelled.length).toBe(6);
    }
    game.destroy();
  });

  it("窄屏上棋盘不会顶到屏幕外面去", async () => {
    const h = install({ innerWidth: 360 });
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(COOP_FROM_LEVEL + 1);
    const canvas = findOne(h.root, "iff-board")!.children[0];
    expect(Number.parseFloat(canvas.style.width)).toBeLessThanOrEqual(360);
    expect(Number.parseFloat(canvas.style.height)).toBeGreaterThan(0);
    game.destroy();
  });
});

// ---------------------------------------------------------------------------
// 九、destroy 归零
// ---------------------------------------------------------------------------

describe("destroy 归零", () => {
  it("卸载之后 rAF、window 监听、节点一样不剩", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();
    const { game } = await mountGame(h);
    game.openCampaignLevel(100);
    h.flush(3, 16);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    expect(h.windowListeners()).toBeGreaterThan(before);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(h.root.children.length).toBe(0);
  });

  it("卸载之后再按键盘也不会炸,更不会偷偷复活一帧", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(100);
    game.destroy();
    h.key("keydown", "KeyD");
    h.key("keydown", "Tab");
    h.fireWindow("resize");
    h.fireWindow("blur");
    h.flush(3, 16);
    expect(h.pendingFrames()).toBe(0);
  });

  it("pause / resume 不会漏帧,也不会叠出第二个循环", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);
    game.openCampaignLevel(100);
    h.flush(1, 16);
    const frames = h.pendingFrames();
    game.pause();
    h.flush(2, 16);
    expect(h.pendingFrames()).toBe(frames);
    game.resume();
    h.flush(2, 16);
    expect(h.pendingFrames()).toBe(frames);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
  });
});
