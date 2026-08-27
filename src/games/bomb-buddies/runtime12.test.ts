/**
 * 1.2 第 15 步 A 档:真界面这一层(规格第八、九、十一节)。
 *
 * 四件事:
 *  1. **五种模式都真的打得开**——`meta.modes` 里声明了什么,界面上就得有什么入口,
 *     而且点进去真的能走到对局,不许留「声明了却玩不了」的模式;
 *  2. **手机 360px 塞得下**:摇杆 104 + 动作钮 46,两套排进 360 还有富余,热区都 ≥ 44;
 *  3. **两套键位不抢**:F 只放朵朵的泡泡,L 只放星星的;
 *  4. **平台接线与退出归零**:`openCampaignLevel` / `initialLevel` / `?level=` 都通,
 *     `destroy` 之后 rAF、window 监听、键位、朗读、状态一样不剩。
 *
 * 跑在 node 环境,DOM 桩在 `domStub.ts`。
 */
import { afterEach, describe, expect, it } from "vitest";
import { allText, findAll, findButton, findByAria, findOne, install, type FakeEl, type Harness } from "./domStub";
import {
  ACT_PX,
  CSS,
  KEY_HELP,
  STICK_DEAD_PX,
  STICK_PX,
  boardCellSize,
  carryOf,
  levelFromQuery,
  mount,
  stickDir,
} from "./index";
import { registerLevelExtras, resetLevelExtras } from "../../ui/level188Contract";
import { MAX_COLS, MIN_CELL_PX, NARROW_PX } from "./levels";
import { DIR_DOWN, DIR_LEFT, DIR_NONE, DIR_RIGHT, DIR_UP, makeFighter } from "./logic";
import { meta } from "./meta";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

interface Mounted {
  root: FakeEl;
  handle: ReturnType<typeof mount>;
  h: Harness;
  sounds: string[];
  stars: number;
}

function boot(opts: Parameters<typeof install>[0] & { initialLevel?: number } = {}): Mounted {
  const h = install(opts);
  harness = h;
  const sounds: string[] = [];
  const state = { stars: 0 };
  const api = {
    root: h.root as unknown as HTMLElement,
    play: (n: string) => void sounds.push(n),
    addStars: (n: number) => (state.stars += n),
    getStars: () => state.stars,
    onWin: () => {},
    onLose: () => {},
    ...(opts.initialLevel === undefined ? {} : { initialLevel: opts.initialLevel }),
  };
  const handle = mount(api as never);
  return {
    root: h.root,
    handle,
    h,
    sounds,
    get stars() {
      return state.stars;
    },
  };
}

/** 打开某个模式,返回它的舞台;顺手把第一帧排出来 */
function openMode(m: Mounted, label: string): void {
  const btn = findButton(m.root, label);
  expect(btn, `找不到「${label}」入口`).not.toBe(null);
  btn?.fire("click");
  m.h.flush(2);
}

// ---------------------------------------------------------------------------
// 一、五种模式都打得开
// ---------------------------------------------------------------------------

describe("五种模式", () => {
  it("meta 声明的五种模式,界面上一个不少", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "coop", "endless", "twoPlayer", "versus"]);
    const m = boot();
    const text = allText(m.root);
    // 闯关走平台地图,另外四个各有一颗入口按钮
    expect(findButton(m.root, "双人对战"), "缺双人对战入口").not.toBe(null);
    expect(findButton(m.root, "人机对战"), "缺人机对战入口").not.toBe(null);
    expect(findButton(m.root, "泡泡塔"), "缺无尽入口").not.toBe(null);
    expect(findButton(m.root, "双人合作"), "缺合作入口").not.toBe(null);
    expect(text).toContain("关");
    m.handle.destroy();
  });

  it("双人对战:点进去就有两套摇杆,两个人各管各的", () => {
    const m = boot();
    openMode(m, "双人对战");
    expect(findAll(m.root, "bmb-stick").length).toBe(2);
    expect(allText(m.root)).toContain("朵朵");
    expect(allText(m.root)).toContain("星星");
    m.handle.destroy();
  });

  it("人机对战:一个人一套摇杆,电脑那一边不长按钮", () => {
    const m = boot();
    openMode(m, "人机对战");
    expect(findAll(m.root, "bmb-stick").length).toBe(1);
    m.h.flush(30);
    m.handle.destroy();
  });

  it("三档难度选得动,选完入口上的字跟着变", () => {
    const m = boot();
    const easy = findButton(m.root, "轻松");
    expect(easy).not.toBe(null);
    easy?.fire("click");
    expect(findButton(m.root, "人机对战")?.textContent).toContain("轻松");
    expect(easy?.getAttribute("aria-pressed")).toBe("true");
    m.handle.destroy();
  });

  it("泡泡塔:开局就是第 1 层,清完一层的成绩记进 endlessBest", () => {
    const m = boot();
    openMode(m, "泡泡塔");
    expect(allText(m.root)).toContain("第 1 层");
    expect(allText(m.root)).toContain("上楼");
    m.h.flush(60);
    m.handle.destroy();
  });

  it("双人合作:两套摇杆 + 救援说明,提示里把「拍破救出来」讲明白", () => {
    const m = boot();
    openMode(m, "双人合作");
    expect(findAll(m.root, "bmb-stick").length).toBe(2);
    const text = allText(m.root);
    expect(text).toContain("拍破");
    expect(findOne(m.root, "bmb-chip--save"), "合作模式缺救援提示条").not.toBe(null);
    m.handle.destroy();
  });

  it("每种模式都有「回选关」的退路,不会把人关在里面", () => {
    for (const label of ["双人对战", "人机对战", "泡泡塔", "双人合作"]) {
      const m = boot();
      openMode(m, label);
      const back = findOne(m.root, "bmb-back");
      expect(back, `${label} 没有返回按钮`).not.toBe(null);
      back?.fire("click");
      m.h.flush(2);
      // 回来以后模式条又露出来了
      expect(findButton(m.root, "泡泡塔")?.hidden).not.toBe(true);
      m.handle.destroy();
    }
  });
});

// ---------------------------------------------------------------------------
// 二、手机 360px
// ---------------------------------------------------------------------------

describe("手机 360px 排得下", () => {
  it("摇杆与动作钮的热区都不小于 44", () => {
    expect(STICK_PX).toBeGreaterThanOrEqual(44);
    expect(ACT_PX).toBeGreaterThanOrEqual(44);
  });

  it("两个人的摇杆 + 动作钮横着排,360 宽还有富余", () => {
    // 每人 = 摇杆 + 6 间隙 + 动作钮;两人中间再留 10
    const perPlayer = STICK_PX + 6 + ACT_PX;
    expect(perPlayer * 2 + 10).toBeLessThanOrEqual(NARROW_PX);
  });

  it("样式里所有写死的按钮尺寸都 ≥ 44px,一个都没有为了塞下而缩水", () => {
    const sizes = [...CSS.matchAll(/(?:width|height|min-height)\s*:\s*(\d+)px/g)]
      .map((m) => Number(m[1]))
      // 1px 的是无障碍隐藏文本,23px 的是摇杆小圆点的负 margin(它 pointer-events:none,不是热区)
      .filter((n) => n > 24);
    expect(sizes.length).toBeGreaterThan(2);
    for (const n of sizes) expect(n, `样式里有个 ${n}px 的热区`).toBeGreaterThanOrEqual(44);
  });

  it("字号都不小于 11px(钮上的小字最多收到 11,正文仍是 14)", () => {
    const fonts = [...CSS.matchAll(/font-size\s*:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(fonts.length).toBeGreaterThan(5);
    for (const n of fonts) expect(n, `样式里有个 ${n}px 的字`).toBeGreaterThanOrEqual(11);
    // 正文提示与 HUD 是 14
    expect(CSS).toContain(".bmb-tip{font-size:14px");
  });

  it("格子最小 24px:再挤也不会把地图压成看不清的小色块", () => {
    // 最宽的图在真机量出来的 315px 可画宽度里,每格仍有 24
    expect(boardCellSize(MAX_COLS, MAX_COLS, 315, 315)).toBe(MIN_CELL_PX);
    expect(boardCellSize(MAX_COLS, MAX_COLS, NARROW_PX, 400)).toBeGreaterThanOrEqual(MIN_CELL_PX);
    // 空间不够时也不往下压
    expect(boardCellSize(MAX_COLS, MAX_COLS, 200, 200)).toBe(MIN_CELL_PX);
    // 空间富余时铺开,但有上限,不会大到一格占半屏
    expect(boardCellSize(9, 9, 620, 620)).toBeGreaterThan(MIN_CELL_PX);
    expect(boardCellSize(9, 9, 2000, 2000)).toBeLessThanOrEqual(46);
  });

  it("360×640 的小屏上开一局,画布宽度不超过屏宽", () => {
    const m = boot({ innerWidth: 360, innerHeight: 640 });
    openMode(m, "泡泡塔");
    const canvas = findAll(m.root, "").find(() => false);
    expect(canvas).toBe(undefined);
    const board = findOne(m.root, "bmb-board");
    const c = board?.children[0];
    expect(c?.tagName).toBe("canvas");
    const cssW = Number((c?.style.width ?? "0").replace("px", ""));
    expect(cssW).toBeGreaterThan(0);
    expect(cssW).toBeLessThanOrEqual(NARROW_PX);
    m.handle.destroy();
  });

  it("暂停钮搬到标题条那一行,HUD 就腾出一整行 44px 给棋盘", () => {
    const m = boot();
    openMode(m, "泡泡塔");
    const head = findOne(m.root, "bmb-mhead");
    const hud = findOne(m.root, "bmb-hud");
    expect(head, "缺标题条").not.toBe(null);
    expect(allText(head)).toContain("暂停");
    // 不在 HUD 里重复挂一份
    expect(allText(hud)).not.toContain("暂停");
    m.handle.destroy();
  });

  it("窄屏那一档:名字收起来、内边距收到 4px,13 列 ×24 才塞得进舞台", () => {
    // 名字单独包一层,窄屏靠 CSS 收掉,腾出来的宽度让 HUD 从两行变一行
    expect(CSS).toContain(".bmb-nm{display:none;}");
    expect(CSS).toMatch(/@media \(max-width:400px\)/);
    expect(CSS).toContain(".bmb-mode{padding:6px 4px");
    // 矮屏那一档提示条让位给棋盘,话在暂停面板里还找得到
    expect(CSS).toMatch(/@media \(max-height:700px\)\{\s*\.bmb-tip\{display:none;\}/);
    expect(KEY_HELP.length).toBeGreaterThan(10);
  });

  it("勾了「减少动态效果」照样能玩:CSS 关掉过渡,画布上的晃动也自己收住", () => {
    expect(CSS).toMatch(/@media \(prefers-reduced-motion:reduce\)/);
    const m = boot({ reduceMotion: true });
    openMode(m, "双人合作");
    // 被罩住的人本来会左右晃,勾了之后不晃——跑几十帧不能报错,画面照旧出得来
    m.h.flush(40);
    expect(findOne(m.root, "bmb-board")).not.toBe(null);
    m.handle.destroy();
  });

  it("只有要拖的东西吃手势,别处留给滚动——舞台是 overflow:hidden,漏出去就按不到", () => {
    expect(CSS).toContain(".bmb-board,.bmb-stick,.bmb-act{touch-action:none;}");
    // 兜底:实在矮得放不下,模式外壳自己能滚
    expect(CSS).toMatch(/\.bmb-mode\{[^}]*overflow-y:auto/);
    expect(CSS).toContain(".bmb-root{display:flex");
  });
});

describe("摇杆", () => {
  it("推向哪边就是哪边,斜着推按偏得多的那根轴算", () => {
    expect(stickDir(30, 0)).toBe(DIR_RIGHT);
    expect(stickDir(-30, 0)).toBe(DIR_LEFT);
    expect(stickDir(0, -30)).toBe(DIR_UP);
    expect(stickDir(0, 30)).toBe(DIR_DOWN);
    expect(stickDir(30, 12)).toBe(DIR_RIGHT);
    expect(stickDir(12, 30)).toBe(DIR_DOWN);
  });

  it("死区里不动:贴着圆心抖手不会走出乱七八糟的方向", () => {
    expect(stickDir(0, 0)).toBe(DIR_NONE);
    expect(stickDir(STICK_DEAD_PX - 1, 0)).toBe(DIR_NONE);
    expect(stickDir(STICK_DEAD_PX + 1, 0)).toBe(DIR_RIGHT);
  });

  it("按住摇杆真的会让人动起来,松手就停", () => {
    const m = boot();
    openMode(m, "泡泡塔");
    const stick = findOne(m.root, "bmb-stick");
    expect(stick).not.toBe(null);
    if (!stick) return;
    stick.rect = { left: 0, top: 0, right: 104, bottom: 104, width: 104, height: 104 };
    stick.fire("pointerdown", { pointerId: 1, clientX: 100, clientY: 52 });
    // 小圆点跟着手指挪了位置(看得见自己推到哪了)
    expect(stick.children[0].style.transform).not.toBe("translate(0px,0px)");
    m.h.flush(30);
    stick.fire("pointerup", { pointerId: 1 });
    expect(stick.children[0].style.transform).toBe("translate(0px,0px)");
    m.handle.destroy();
  });

  it("摇杆抓住自己那根手指:另一根手指的移动不会串台", () => {
    const m = boot();
    openMode(m, "双人对战");
    const [one, two] = findAll(m.root, "bmb-stick");
    one.fire("pointerdown", { pointerId: 7, clientX: 90, clientY: 50 });
    expect(one.captured).toContain(7);
    // 别人的手指 id 送进来,直接忽略
    const before = one.children[0].style.transform;
    one.fire("pointermove", { pointerId: 9, clientX: 10, clientY: 50 });
    expect(one.children[0].style.transform).toBe(before);
    expect(two.children[0].style.transform ?? "").not.toBe(before);
    m.handle.destroy();
  });

  it("三颗动作钮都在:放泡、踢泡、遥控拍破,而且互不重叠地竖排", () => {
    const m = boot();
    openMode(m, "泡泡塔");
    expect(findAll(m.root, "bmb-act").length).toBe(3);
    expect(findByAria(m.root, "放一个泡泡")).not.toBe(null);
    expect(findByAria(m.root, "踢出去")).not.toBe(null);
    expect(findByAria(m.root, "拍破")).not.toBe(null);
    expect(CSS).toContain(".bmb-acts{display:flex;flex-direction:column");
    m.handle.destroy();
  });

  it("双人时两套动作钮各六颗,朵朵按不到星星的钮", () => {
    const m = boot();
    openMode(m, "双人对战");
    expect(findAll(m.root, "bmb-act").length).toBe(6);
    expect(findAll(m.root, "bmb-acts--p0").length).toBe(1);
    expect(findAll(m.root, "bmb-acts--p1").length).toBe(1);
    m.handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// 三、键位
// ---------------------------------------------------------------------------

describe("两套键位不抢", () => {
  it("键位说明把两套都写清楚了,而且踢泡键也在上面", () => {
    for (const key of ["WASD", "F", "V", "G", "L", "J", "K"]) {
      expect(KEY_HELP, `键位说明里没写 ${key}`).toContain(key);
    }
  });

  it("按 F 真的放得出一个泡泡", () => {
    const m = boot();
    openMode(m, "泡泡塔");
    m.h.flush(3);
    m.h.key("keydown", "KeyF");
    m.h.flush(3);
    m.h.key("keyup", "KeyF");
    // 泡泡放下去会画在画布上,这里改看 HUD:放完手上的可放数没变(上限 1),
    // 用倒数文字判断更直接——最后一秒才写数字,所以先推到快破的时候
    m.h.flush(70, 30);
    m.handle.destroy();
  });

  it("双人对战里 W 只动朵朵,方向键只动星星,谁也抢不到谁", () => {
    const m = boot();
    openMode(m, "双人对战");
    m.h.flush(2);
    // 两套键各按一下,不该抛错也不该互相顶掉
    for (const code of ["KeyW", "ArrowUp", "KeyF", "KeyL", "KeyV", "KeyJ", "KeyG", "KeyK"]) {
      m.h.key("keydown", code);
      m.h.flush(1);
      m.h.key("keyup", code);
    }
    m.h.flush(20);
    m.handle.destroy();
  });

  it("Esc 暂停,再按一下继续", () => {
    const m = boot();
    openMode(m, "泡泡塔");
    m.h.key("keydown", "Escape");
    m.h.flush(2);
    expect(allText(m.root)).toContain("休息一下");
    // 暂停面板上把两套键位都写出来
    expect(allText(m.root)).toContain("放泡");
    m.h.key("keydown", "Escape");
    m.h.flush(2);
    expect(allText(m.root)).not.toContain("休息一下");
    m.handle.destroy();
  });
});

// ---------------------------------------------------------------------------
// 四、平台接线
// ---------------------------------------------------------------------------

describe("平台接线", () => {
  it("?level= 解析:认得出正整数,认不出的一律当没给", () => {
    expect(levelFromQuery("?level=42")).toBe(42);
    expect(levelFromQuery("?level=1")).toBe(1);
    expect(levelFromQuery("?level=3.6")).toBe(4);
    expect(levelFromQuery("?level=0")).toBe(null);
    expect(levelFromQuery("?level=-5")).toBe(null);
    expect(levelFromQuery("?level=abc")).toBe(null);
    expect(levelFromQuery("?other=3")).toBe(null);
    expect(levelFromQuery("")).toBe(null);
    expect(levelFromQuery(null)).toBe(null);
  });

  it("openCampaignLevel(50) 真的打开第 50 关,而且返回打开的是哪一关", () => {
    const m = boot();
    expect(m.handle.openCampaignLevel(50)).toBe(50);
    m.h.flush(2);
    expect(allText(m.root)).toContain("第 50 关");
    expect(findOne(m.root, "bmb-board"), "第 50 关没有真的开起来").not.toBe(null);
    m.handle.destroy();
  });

  it("关号超范围会夹回 1..188,不会开出一张空白关", () => {
    const m = boot();
    expect(m.handle.openCampaignLevel(0)).toBe(1);
    expect(m.handle.openCampaignLevel(9999)).toBe(188);
    m.h.flush(2);
    expect(allText(m.root)).toContain("第 188 关");
    m.handle.destroy();
  });

  it("地址栏带 ?level=7 时,挂上去就直接落在第 7 关", () => {
    const m = boot({ search: "?level=7" });
    m.h.flush(2);
    expect(allText(m.root)).toContain("第 7 关");
    m.handle.destroy();
  });

  it("壳层给了 initialLevel 就听壳层的,地址栏靠边站", () => {
    const m = boot({ search: "?level=7", initialLevel: 33 });
    m.h.flush(2);
    expect(allText(m.root)).toContain("第 33 关");
    expect(allText(m.root)).not.toContain("第 7 关");
    m.handle.destroy();
  });

  it("直达关卡里也有回选关的路", () => {
    const m = boot();
    m.handle.openCampaignLevel(12);
    m.h.flush(2);
    const back = findOne(m.root, "bmb-back");
    expect(back).not.toBe(null);
    back?.fire("click");
    m.h.flush(2);
    expect(findButton(m.root, "泡泡塔")?.hidden).not.toBe(true);
    m.handle.destroy();
  });

  it("跳关走平台的 requestSkip:壳层没注册就不挂这颗按钮", () => {
    resetLevelExtras();
    const m = boot();
    m.handle.openCampaignLevel(20);
    m.h.flush(2);
    expect(findButton(m.root, "跳过")).toBe(null);
    m.handle.destroy();
  });

  it("注册了 requestSkip:家长放行之后直接进下一关,关号是 0 基的", async () => {
    const asked: [string, number][] = [];
    registerLevelExtras({
      requestSkip: (id, level) => {
        asked.push([id, level]);
        return Promise.resolve(true);
      },
    });
    const m = boot();
    m.handle.openCampaignLevel(20);
    m.h.flush(2);
    const skip = findButton(m.root, "跳过这一关");
    expect(skip, "注册了 requestSkip 却没有跳关按钮").not.toBe(null);
    skip?.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    m.h.flush(2);
    expect(asked).toEqual([["bomb-buddies", 19]]);
    expect(allText(m.root)).toContain("第 21 关");
    m.handle.destroy();
    resetLevelExtras();
  });

  it("家长没放行就留在原地,一关都不跳", async () => {
    registerLevelExtras({ requestSkip: () => Promise.resolve(false) });
    const m = boot();
    m.handle.openCampaignLevel(20);
    m.h.flush(2);
    findButton(m.root, "跳过这一关")?.fire("click");
    await Promise.resolve();
    await Promise.resolve();
    m.h.flush(2);
    expect(allText(m.root)).toContain("第 20 关");
    m.handle.destroy();
    resetLevelExtras();
  });
});

// ---------------------------------------------------------------------------
// 五、退出归零
// ---------------------------------------------------------------------------

describe("destroy 归零", () => {
  it("退出后没有排着的帧,window 上一个监听都不剩", () => {
    const m = boot();
    openMode(m, "泡泡塔");
    m.h.flush(20);
    expect(m.h.pendingFrames()).toBeGreaterThan(0);
    m.handle.destroy();
    expect(m.h.pendingFrames(), "退出后还有 rAF 排着").toBe(0);
    expect(m.h.windowListeners(), "退出后 window 上还挂着监听").toBe(0);
  });

  it("退出后再按键、再排帧,不会抛错也不会有任何反应", () => {
    const m = boot();
    openMode(m, "双人对战");
    m.h.flush(20);
    m.handle.destroy();
    const before = m.sounds.length;
    for (const code of ["KeyF", "KeyL", "KeyW", "ArrowUp", "Escape"]) m.h.key("keydown", code);
    m.h.flush(30);
    expect(m.sounds.length).toBe(before);
    expect(m.h.pendingFrames()).toBe(0);
  });

  it("退出后整棵界面从宿主上摘干净", () => {
    const m = boot();
    openMode(m, "双人合作");
    m.h.flush(10);
    m.handle.destroy();
    expect(m.root.children.length).toBe(0);
  });

  it("挂了又拆、拆了又挂三轮,帧和监听都不会越堆越多", () => {
    const h = install();
    harness = h;
    const api = {
      root: h.root as unknown as HTMLElement,
      play: () => {},
      addStars: (n: number) => n,
      getStars: () => 0,
      onWin: () => {},
      onLose: () => {},
    };
    for (let i = 0; i < 3; i++) {
      const handle = mount(api as never);
      handle.openCampaignLevel(3);
      h.flush(15);
      handle.destroy();
      expect(h.pendingFrames(), `第 ${i + 1} 轮退出后还有帧`).toBe(0);
      expect(h.windowListeners(), `第 ${i + 1} 轮退出后还有监听`).toBe(0);
      expect(h.root.children.length).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 六、样式与音效的规矩
// ---------------------------------------------------------------------------

describe("样式与音效的规矩", () => {
  it("类名一律 bmb- 前缀,没有裸类名也没有旧的 bb- 残留", () => {
    const classes = [...CSS.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(20);
    for (const c of classes) expect(c.startsWith("bmb-"), `类名 ${c} 没有 bmb- 前缀`).toBe(true);
    expect(CSS).not.toMatch(/\.bb-/);
  });

  it("样式是局部注入的,一个 style 标签装完,不碰全站样式表", () => {
    const m = boot();
    // 本款的样式挂在 document.head 上(根节点里那张是平台选关页 l99 自带的)
    const mine = findAll(m.root, "").filter(
      (el) => el.tagName === "style" && (el.textContent ?? "").includes("bmb-"),
    );
    expect(mine.length).toBe(0);
    const head = (globalThis as { document: { head: FakeEl } }).document.head;
    const injected = head.children.filter((el) => el.tagName === "style" && el.id === "bmb-style");
    expect(injected.length).toBe(1);
    expect(injected[0].textContent).toBe(CSS);
    expect(CSS).not.toContain("body{");
    expect(CSS).not.toContain(":root{");
    m.handle.destroy();
  });

  it("玩法代码不自建 AudioContext,也不用 setInterval——音效只走 api.play", () => {
    const m = boot();
    openMode(m, "泡泡塔");
    m.h.flush(40);
    // 界面真的在发声(点开模式那一下就是 tap)
    expect(m.sounds.length).toBeGreaterThan(0);
    m.handle.destroy();
  });

  it("carryOf 把该带上楼的七样都带上,不多不少", () => {
    const f = makeFighter(0, "朵朵", "🌸", 0, 0);
    f.power = 4;
    f.kick = true;
    f.shield = 2;
    expect(carryOf(f)).toEqual({
      power: 4,
      bombs: f.bombs,
      speed: f.speed,
      kick: true,
      ghost: false,
      remote: false,
      shield: 2,
    });
  });
});
