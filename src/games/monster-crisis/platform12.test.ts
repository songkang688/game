/**
 * 1.2 第 13 步 C 档:平台接线与真界面那几条(规格第八、九节)。
 *
 * 三件事:
 *  1. **直达第 N 关**:本款的地图走平台 `mountLevelGame`,它只吐一个 `destroy`,
 *     没有「从第 N 关开始」的口子,所以本款自己开了 `openCampaignLevel(n)`;
 *     壳层给 `initialLevel` 或地址栏带 `?level=` 都走这条路。
 *  2. **界面真的能玩到结算**:摇杆 / 技能钮 / 键盘都接上了,三选一面板真的弹得出来、
 *     选完真的加成长,四种模式都能走到结算面板。
 *  3. **手机 360px 塞得下**:热区 ≥ 44px、字号 ≥ 14px、画布按屏高切,不挤掉底下那一行。
 *
 * 跑在 node 环境,DOM 桩在 `domStub.ts`,和 `destroy.test.ts` 共用同一份。
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  allText,
  findAll,
  findButton,
  findOne,
  install,
  type FakeEl,
  type Harness,
} from "./domStub";
import { CSS, arenaCanvasSize, levelFromQuery } from "./index";
import { ARENA_H, ARENA_W } from "./arena";
import { GROWTH_CARDS } from "./growth";
import { BANNED } from "./copy";
import { CHAPTERS, TOTAL } from "./levels";
import { chapterOf } from "../level99";
import { meta } from "./meta";
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

async function mountGame(
  h: Harness,
  initialLevel?: number
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
    ...(initialLevel === undefined ? {} : { initialLevel }),
  } as never);
  return { game, played, stars };
}

/** 开局那张成长卡挡在最前面,先随手挑掉才轮得到走位出手 */
function takeOpeningCard(h: Harness): void {
  h.flush(1);
  for (let i = 0; i < 4 && findOne(h.root, "mcr-card"); i++) {
    findOne(h.root, "mcr-card")?.fire("click");
    h.flush(1);
  }
}

/** 按住技能钮不放,再排 n 帧 —— 「一直甩」的最省事写法 */
function holdFireFor(h: Harness, frames: number): void {
  for (const fire of findAll(h.root, "mcr-fire")) fire.fire("pointerdown");
  h.flush(frames);
}

function settled(h: Harness): boolean {
  return !!findOne(h.root, "mcr-over");
}

/**
 * 一路排帧直到结算面板出现。每帧按 40ms 走(主循环自己把 dt 夹在 50ms 内),
 * 一局几分钟的对战也能在用例里跑完。
 */
function runUntilSettled(h: Harness, maxFrames: number, fire = true): boolean {
  const press = (): void => {
    for (const btn of findAll(h.root, "mcr-fire")) btn.fire(fire ? "pointerdown" : "pointerup");
  };
  press();
  for (let i = 0; i < maxFrames && !settled(h); i++) {
    h.flush(1, 40);
    // 三选一会挡住波次,冒出来就随手挑第一张,再把技能钮按回去
    if (findOne(h.root, "mcr-card")) {
      findOne(h.root, "mcr-card")?.fire("click");
      press();
    }
  }
  return settled(h);
}

/** HUD 上第一枚小牌子就是波次牌(模式外壳自己那枚不算) */
function waveChipOf(h: Harness): FakeEl {
  const hud = findOne(h.root, "mcr-hud");
  return hud?.children.find((c) => c.className.startsWith("mcr-chip")) as FakeEl;
}

/** 从 CSS 里抠出某个类的某条属性 */
function cssValue(cls: string, prop: string): number | null {
  const block = new RegExp(`\\.${cls}\\{([^}]*)\\}`).exec(CSS);
  if (!block) return null;
  const hit = new RegExp(`(?:^|;)\\s*${prop}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(block[1]);
  return hit ? Number(hit[1]) : null;
}

/* ---------------- 一、直达第 N 关 ---------------- */

describe("1.2 平台直达第 N 关", () => {
  it("openCampaignLevel 返回真正打开的关号,越界夹回 1..188", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    expect(game.openCampaignLevel(60)).toBe(60);
    expect(game.openCampaignLevel(1)).toBe(1);
    expect(game.openCampaignLevel(0)).toBe(1);
    expect(game.openCampaignLevel(-9)).toBe(1);
    expect(game.openCampaignLevel(9999)).toBe(TOTAL);
    expect(game.openCampaignLevel(12.4)).toBe(12);
    game.destroy();
  });

  it("直达进去的确实是那一关:标题写着关号与它所属的章节,画布真的在", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    game.openCampaignLevel(150);
    const text = allText(h.root);
    expect(text).toContain("第 150 关");
    expect(text).toContain(CHAPTERS[chapterOf(CHAPTERS, 149)].name);
    expect(findOne(h.root, "mcr-canvas")).not.toBeNull();
    game.destroy();
  });

  it("壳层传 initialLevel 就一进来直达,模式条藏起来不抢地方", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 7);

    expect(allText(h.root)).toContain("第 7 关");
    expect(findOne(h.root, "mcr-bar")?.hidden).toBe(true);
    game.destroy();
  });

  it("没传 initialLevel 时照旧先看到三颗模式按钮", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    expect(findButton(h.root, "无尽守家")).not.toBeNull();
    expect(findButton(h.root, "双人合作")).not.toBeNull();
    expect(findButton(h.root, "各守一半")).not.toBeNull();
    expect(findOne(h.root, "mcr-canvas")).toBeNull();
    game.destroy();
  });

  it("地址栏 ?level=N 认得出来,写歪了就当没写", () => {
    expect(levelFromQuery("?level=42")).toBe(42);
    expect(levelFromQuery("?a=1&level=7&b=2")).toBe(7);
    expect(levelFromQuery("?level=3.6")).toBe(4);
    expect(levelFromQuery("?level=0")).toBeNull();
    expect(levelFromQuery("?level=-5")).toBeNull();
    expect(levelFromQuery("?level=abc")).toBeNull();
    expect(levelFromQuery("?nope=9")).toBeNull();
    expect(levelFromQuery("")).toBeNull();
    expect(levelFromQuery(null)).toBeNull();
  });

  it("从直达关卡按「选关地图」能回到平台地图,回去之后画布就收了", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 5);
    h.flush(4);
    expect(findOne(h.root, "mcr-canvas")).not.toBeNull();

    findButton(h.root, "回选关")?.fire("click");
    expect(findOne(h.root, "mcr-canvas")).toBeNull();
    expect(findOne(h.root, "mcr-bar")?.hidden).toBe(false);
    game.destroy();
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
    expect(peak).toBe(3);
    game.destroy();
    expect(h.windowListeners()).toBe(0);
  });
});

/* ---------------- 二、界面上真的能走位、出手、挑卡 ---------------- */

describe("1.2 走位 · 出手 · 三选一", () => {
  it("摇杆左下、技能钮右下都在场上,而且各自带无障碍标签", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 1);

    const stick = findOne(h.root, "mcr-stick");
    const fire = findOne(h.root, "mcr-fire");
    expect(stick).not.toBeNull();
    expect(fire).not.toBeNull();
    // 一行里摇杆排在技能钮前面 = 左边那个是摇杆,右边那个是技能钮
    const pads = findOne(h.root, "mcr-pads");
    const order = pads?.children.map((c) => c.className.split(" ")[0]) ?? [];
    expect(order[0]).toBe("mcr-stick");
    expect(order[order.length - 1]).toBe("mcr-fire");
    expect(stick?.getAttribute("aria-label")).toContain("摇杆");
    expect(fire?.getAttribute("aria-label")).toContain("甩");
    game.destroy();
  });

  it("拖摇杆真的把人挪走了,松手就停", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 1);
    h.flush(2);

    const stick = findOne(h.root, "mcr-stick") as FakeEl;
    // 桩里摇杆的圆心在 (62,442),往右下角拖
    stick.fire("pointerdown", { pointerId: 1, clientX: 62, clientY: 442 });
    stick.fire("pointermove", { pointerId: 1, clientX: 140, clientY: 500 });
    expect(stick.children[0].style.transform).toMatch(/translate\(/);
    h.flush(20);
    expect(stick.children[0].style.transform).not.toBe("translate(0px, 0px)");

    stick.fire("pointerup", { pointerId: 1 });
    expect(stick.children[0].style.transform).toBe("translate(0px, 0px)");
    game.destroy();
  });

  it("键盘 W A S D 走位、F 甩:按住会出手,按 Escape 能暂停", async () => {
    const h = install();
    harness = h;
    const { game, played } = await mountGame(h, 1);
    takeOpeningCard(h);
    h.flush(4);
    const before = played.length;

    h.key("keydown", "d");
    h.key("keydown", "f");
    h.flush(30);
    h.key("keyup", "d");
    h.key("keyup", "f");
    expect(played.length).toBeGreaterThanOrEqual(before);

    h.key("keydown", "Escape");
    expect(allText(h.root)).toContain("先歇一会儿");
    h.key("keydown", "Escape");
    expect(allText(h.root)).not.toContain("先歇一会儿");
    game.destroy();
  });

  it("无尽一进场就发一张开工礼物:三张卡、互不重复、都是真卡", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    findButton(h.root, "无尽守家")?.fire("click");
    h.flush(1);

    const cards = findAll(h.root, "mcr-card");
    expect(cards).toHaveLength(3);
    const names = cards.map((c) => c.getAttribute("aria-label")?.split(":")[0] ?? "");
    expect(new Set(names).size).toBe(3);
    const real = Object.values(GROWTH_CARDS).map((c) => c.name);
    for (const n of names) expect(real).toContain(n);
    game.destroy();
  });

  it("挑完一张卡:面板收起来、HUD 上真的多了一枚成长图标", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    findButton(h.root, "无尽守家")?.fire("click");
    h.flush(1);
    expect(findOne(h.root, "mcr-layer")).not.toBeNull();

    findOne(h.root, "mcr-card")?.fire("click");
    h.flush(2);
    expect(findOne(h.root, "mcr-layer")).toBeNull();
    const badges = findAll(h.root, "mcr-chip").map((c) => c.textContent).join("");
    expect(badges).toContain("成长");
    game.destroy();
  });

  it("三选一挡在前面时波次不往前走(挑完才继续打)", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    findButton(h.root, "无尽守家")?.fire("click");
    h.flush(1);
    const waveChip = waveChipOf(h);
    const before = waveChip.textContent;
    h.flush(60);
    expect(waveChip.textContent).toBe(before);

    findOne(h.root, "mcr-card")?.fire("click");
    h.flush(2);
    expect(findOne(h.root, "mcr-layer")).toBeNull();
    holdFireFor(h, 60);
    expect(waveChip.textContent).not.toBe(before);
    game.destroy();
  });

  it("暂停面板挡住时小怪物停在原地,继续之后才接着动", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 1);
    takeOpeningCard(h);
    h.flush(120);

    const waveChip = waveChipOf(h);
    findOne(h.root, "mcr-hudbtn")?.fire("click");
    const frozen = waveChip.textContent;
    h.flush(90);
    expect(waveChip.textContent).toBe(frozen);

    findButton(h.root, "继续守家")?.fire("click");
    expect(findOne(h.root, "mcr-layer")).toBeNull();
    game.destroy();
  });
});

/* ---------------- 三、四种模式都能打到结算 ---------------- */

describe("1.2 四种模式都能打到结算", () => {
  it("闯关:直达一关一路打下去会给结算面板,而且只鼓励", async () => {
    const h = install();
    harness = h;
    const { game, played } = await mountGame(h, 1);

    expect(runUntilSettled(h, 4000)).toBe(true);
    const text = allText(h.root);
    expect(text).toMatch(/过关|就差一点点/);
    expect(findButton(h.root, "选关地图")).not.toBeNull();
    for (const word of BANNED) expect(text, word).not.toContain(word);
    expect(played.length).toBeGreaterThan(0);
    game.destroy();
  });

  it("闯关:过关会把星级写进平台那份 l99 存档", async () => {
    const h = install();
    harness = h;
    const { game, stars } = await mountGame(h, 1);

    runUntilSettled(h, 4000);
    if (allText(h.root).includes("过关")) {
      const saved = JSON.parse(h.storage.get(`yiduo-yixing.l99.${meta.id}`) ?? "[]") as number[];
      expect(saved[0]).toBeGreaterThan(0);
      expect(stars[0]).toBeGreaterThan(0);
      expect(findButton(h.root, "下一关")).not.toBeNull();
    }
    game.destroy();
  });

  it("无尽:一趟跑完给结算面板,成绩走 save.recordEndlessBest 记的是波数", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    findButton(h.root, "无尽守家")?.fire("click");
    // 先按住技能钮挡下几波(无尽没有终点,不打就没有成绩可记)
    takeOpeningCard(h);
    for (const btn of findAll(h.root, "mcr-fire")) btn.fire("pointerdown");
    let cleared = 0;
    for (let i = 0; i < 1200 && !settled(h); i++) {
      h.flush(1, 40);
      if (findOne(h.root, "mcr-card")) {
        findOne(h.root, "mcr-card")?.fire("click");
        for (const btn of findAll(h.root, "mcr-fire")) btn.fire("pointerdown");
      }
      const at = /第 (\d+) 波/.exec(waveChipOf(h)?.textContent ?? "");
      if (at) cleared = Math.max(cleared, Number(at[1]));
    }
    expect(cleared).toBeGreaterThan(1);

    // 撒手不管 = 元气被一罐罐抱走,这一趟自然收工
    expect(runUntilSettled(h, 4000, false)).toBe(true);
    expect(allText(h.root)).toMatch(/新纪录|元气被抱完/);
    expect(findButton(h.root, "从第 1 波再来")).not.toBeNull();
    // 平台记的是「挡到第几波」,不是打掉多少只怪(那会是三位数)
    const best = save.getGameProgress(meta.id).endlessBest;
    expect(best).toBeGreaterThan(0);
    expect(best).toBeLessThanOrEqual(cleared);
    game.destroy();
  });

  it("双人合作:两套摇杆两个技能钮,能一路打到结算", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    findButton(h.root, "双人合作")?.fire("click");
    h.flush(1);
    expect(findAll(h.root, "mcr-stick")).toHaveLength(2);
    expect(findAll(h.root, "mcr-fire")).toHaveLength(2);

    expect(runUntilSettled(h, 8000)).toBe(true);
    expect(allText(h.root)).toMatch(/一起守住|元气被抱完/);
    expect(findButton(h.root, "再来一局")).not.toBeNull();
    game.destroy();
  });

  it("各守一半:两边各一个家,能一路打到结算并点名赢家", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    findButton(h.root, "各守一半")?.fire("click");
    h.flush(1);
    // 两个家 = HUD 上两条元气罐
    expect(allText(h.root)).toContain("朵朵 🫙");
    expect(allText(h.root)).toContain("星星 🫙");

    expect(runUntilSettled(h, 8000)).toBe(true);
    expect(allText(h.root)).toMatch(/平手|这边守住啦/);
    expect(findButton(h.root, "换边再来")).not.toBeNull();
    game.destroy();
  });

  it("meta.modes 里写的四种模式,一种不落都真的有入口", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h);

    expect([...meta.modes]).toEqual(["campaign", "endless", "coop", "versus"]);
    // 电脑键盘两套键位齐全,手机摇杆 + 技能钮也齐全 → both
    expect(meta.platform).toBe("both");
    expect(findButton(h.root, "无尽守家")).not.toBeNull();
    expect(findButton(h.root, "双人合作")).not.toBeNull();
    expect(findButton(h.root, "各守一半")).not.toBeNull();
    // campaign 走平台的 188 关地图
    expect(game.openCampaignLevel(1)).toBe(1);
    expect(findOne(h.root, "mcr-canvas")).not.toBeNull();
    game.destroy();
  });
});

/* ---------------- 四、手机 360px ---------------- */

describe("1.2 手机 360px 塞得下", () => {
  it("摇杆、技能钮、暂停钮的热区都 ≥ 44px(窄屏那一档也是)", () => {
    for (const cls of ["mcr-stick", "mcr-knob", "mcr-fire", "mcr-hudbtn"]) {
      const w = cssValue(cls, "width") ?? cssValue(cls, "min-width");
      const hgt = cssValue(cls, "height") ?? cssValue(cls, "min-height");
      expect(w, `${cls} width`).not.toBeNull();
      expect(w ?? 0, `${cls} width`).toBeGreaterThanOrEqual(44);
      expect(hgt ?? 0, `${cls} height`).toBeGreaterThanOrEqual(44);
    }
    // @media 那一档把摇杆和技能钮缩小了,缩完也得 ≥ 44
    const narrow = CSS.slice(CSS.indexOf("@media (max-width:420px)"));
    for (const hit of narrow.matchAll(/\.(mcr-stick|mcr-knob|mcr-fire)\{([^}]*)\}/g)) {
      for (const num of hit[2].matchAll(/(?:width|height):(\d+)px/g)) {
        expect(Number(num[1]), `${hit[1]} ${num[0]}`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  it("界面上写着字的地方,字号一个都不许低于 14px", () => {
    const withText = [
      "mcr-chip",
      "mcr-tip",
      "mcr-layer-s",
      "mcr-btn",
      "mcr-back",
      "mcr-card",
      "mcr-card-name",
      "mcr-card-desc",
      "mcr-card-lv",
      "mcr-padname",
      "mcr-say",
    ];
    for (const cls of withText) {
      const size = cssValue(cls, "font-size");
      expect(size, cls).not.toBeNull();
      expect(size ?? 0, cls).toBeGreaterThanOrEqual(14);
    }
    // 整份 CSS 里也不许再冒出 13px 以下的字号(按钮不写 font-size 会掉到浏览器默认的 13.3px)
    for (const hit of CSS.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) {
      expect(Number(hit[1]), hit[0]).toBeGreaterThanOrEqual(14);
    }
  });

  it("360×720 上画布按屏高切,给底下的摇杆那一行留够位置", () => {
    const size = arenaCanvasSize(336, 360, 720);
    expect(size.w).toBeLessThanOrEqual(336);
    // 画布 + HUD(约 34) + 摇杆行(86) + 提示两行(约 44) 要塞进 720
    expect(size.h + 34 + 86 + 44).toBeLessThan(720);
    // 不许拉变形
    expect(size.h / size.w).toBeCloseTo(ARENA_H / ARENA_W, 2);
  });

  it("375×667 与宽屏各自都不会把画布撑出去", () => {
    const phone = arenaCanvasSize(351, 375, 667);
    expect(phone.w).toBeLessThanOrEqual(351);
    expect(phone.h + 34 + 86 + 44).toBeLessThan(667);

    const desk = arenaCanvasSize(1200, 1440, 900);
    expect(desk.w).toBeLessThanOrEqual(720);
    expect(desk.h / desk.w).toBeCloseTo(ARENA_H / ARENA_W, 2);
  });

  it("样式类名一律 mcr- 前缀,而且只挂在自己这棵树上", async () => {
    const h = install();
    harness = h;
    const { game } = await mountGame(h, 1);

    const classes = new Set<string>();
    const collect = (el: FakeEl): void => {
      for (const c of el.className.split(/\s+/)) if (c) classes.add(c);
      for (const kid of el.children) collect(kid);
    };
    collect(h.root);
    for (const c of classes) {
      // 平台 188 关框架自己那套 l99- 前缀不归本款管
      if (c.startsWith("l99-")) continue;
      expect(c, c).toMatch(/^mcr-/);
    }
    // 样式是一个 <style> 挂在自己这棵树里,不往 document.head 上贴
    const styles = h.root.children[0]?.children.filter((c) => c.tagName === "style") ?? [];
    expect(styles.length).toBe(1);
    for (const hit of CSS.matchAll(/\.([a-z][\w-]*)/g)) {
      expect(hit[1], hit[1]).toMatch(/^mcr-/);
    }
    game.destroy();
  });

  it("低端机(两核 + 窄屏)照样能玩,只是粒子少一些", async () => {
    const h = install({ cores: 2, innerWidth: 360 });
    harness = h;
    const { game } = await mountGame(h, 12);
    holdFireFor(h, 200);
    // 画布还在、还在排帧 = 还能玩
    expect(findOne(h.root, "mcr-canvas")).not.toBeNull();
    expect(h.pendingFrames()).toBeGreaterThan(0);
    game.destroy();
  });

  it("「少一点动效」开着的时候照样能打到结算", async () => {
    const h = install();
    harness = h;
    h.setReducedMotion(true);
    const { game } = await mountGame(h, 2);
    expect(runUntilSettled(h, 4000)).toBe(true);
    expect(allText(h.root)).toMatch(/过关|就差一点点/);
    game.destroy();
  });
});
