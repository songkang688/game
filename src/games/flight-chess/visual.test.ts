/**
 * 飞行棋乐园 · 1.3 整帧视觉契约（对照 docs/plan-1.3-step4-C-flight-chess.md 第七节）。
 *
 * 用本目录的 domStub 把整张牌桌挂起来，假定时器推进动画，逐条钉住：
 * 1) token 按钮不再是纯 emoji 文本：内含 SVG 且 aria-label 仍是 describePos(...)；
 * 2) 骰子显示点数与 settleRoll 收到的 value 一致，掷 6 金边闪一次；
 * 3) 击落动画节点（打转 / 降落伞）结束后清理，被击落棋子最终 left/top 与基地坐标一致；
 * 4) prefers-reduced-motion 下逐格跳 / 拉高 / 打转 / 尾迹类一个都不加；
 * 5) 起飞尾迹、跳格影子分离、迭子 ×2 徽章、座位卡机位进度、终局烟花全接住。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE, COLOR_INFO, GOAL, HOME_XY, RING_XY, baseXY, describePos, type Color } from "./board";
import { CLASSIC_RULES } from "./dice";
import { byClass, install, walk, type FakeEl, type Harness } from "./domStub";
import {
  ARC_MS,
  BEAT_MS,
  CHUTE_MS,
  FIREWORK_MS,
  FLASH_MS,
  HOP_MS,
  SHOT_MS,
  createTable,
  decorArt,
  pctOf,
  tokenXY,
  type OverResult,
  type TableOptions
} from "./index";

const CELL = 100 / 15;

interface MountExtras {
  setup?: number[][];
  dice?: number[];
  judge?: TableOptions["judge"];
  onOver?: (r: OverResult) => void;
}

/** 一个人类座位(朵朵) + 一个只当路障的座位,走位全靠固定骰序 */
function mountTable(h: Harness, extra: MountExtras = {}): ReturnType<typeof createTable> {
  return createTable(h.root as unknown as HTMLElement, {
    seats: [
      { color: 0, human: "duo", tier: "pro" },
      { color: 2, human: null, tier: "rookie", idle: true }
    ],
    rules: CLASSIC_RULES,
    setup: extra.setup ?? [[10, BASE, BASE, BASE], [], [39, BASE, BASE, BASE], []],
    dice: extra.dice ?? [3, 2, 2, 2, 2, 2],
    seed: 11,
    goalText: "测试局",
    sfx: () => undefined,
    judge: extra.judge,
    onOver: extra.onOver ?? (() => undefined)
  });
}

let cleanup: Array<() => void> = [];

afterEach(() => {
  for (const fn of cleanup.reverse()) fn();
  cleanup = [];
  vi.useRealTimers();
});

function setup(opts: { reduced?: boolean } = {}): Harness {
  vi.useFakeTimers();
  const h = install(opts);
  cleanup.push(() => h.restore());
  return h;
}

/** 掷完骰(转骰帧 + 结算)再稳一拍的时长 */
const SETTLE = 70 * 10 + 60;

function tokenOf(h: Harness, color: Color, idx: number): FakeEl {
  const hits = byClass(h.root, "fc-token").filter(
    (el) => (el.getAttribute("aria-label") ?? "").startsWith(COLOR_INFO[color].name)
  );
  // 同色四架按创建顺序排,idx 就是第几架
  return hits[idx];
}

describe("视觉契约 1 · 棋子是 SVG 小飞机", () => {
  it("16 架 token 都含 SVG,aria-label 仍是 describePos 的原文,不再是纯 emoji 文本", () => {
    const h = setup();
    const table = mountTable(h);
    cleanup.push(() => table.destroy());
    const tokens = byClass(h.root, "fc-token");
    expect(tokens).toHaveLength(8);
    for (const btn of tokens) {
      expect(btn.textContent).toBe("");
      const rot = byClass(btn, "fc-token-rot")[0];
      expect(rot.innerHTML).toContain("<svg");
      expect(rot.innerHTML).toContain("fc-plane");
    }
    expect(tokenOf(h, 0, 0).getAttribute("aria-label")).toBe(describePos(0, 10));
    expect(tokenOf(h, 2, 1).getAttribute("aria-label")).toBe(describePos(2, BASE));
    // 每架都有影子(2.5D 高度感的地面参照)
    expect(byClass(h.root, "fc-token-shadow")).toHaveLength(8);
  });

  it("基地停机是 park 姿态,到终点换 land 花环姿态", () => {
    const h = setup();
    const table = mountTable(h, { setup: [[GOAL, BASE, 10, BASE], [], [], []] });
    cleanup.push(() => table.destroy());
    const rots = byClass(h.root, "fc-token-rot");
    const html = rots.map((r) => r.innerHTML).join("|");
    expect(html).toContain("fc-plane-land");
    expect(html).toContain("fc-wreath");
    expect(html).toContain("fc-plane-park");
    expect(html).toContain("fc-plane-fly");
  });

  it("迭子:两机错位 45° 叠停,底部一枚 ×2 徽章", () => {
    const h = setup();
    const table = mountTable(h, { setup: [[10, 10, BASE, BASE], [], [], []] });
    cleanup.push(() => table.destroy());
    const shown = byClass(h.root, "fc-stackwrap").filter((el) => !el.hidden);
    expect(shown).toHaveLength(1);
    expect(shown[0].innerHTML).toContain("×2");
    const [a, b] = [tokenOf(h, 0, 0), tokenOf(h, 0, 1)].map(
      (btn) => byClass(btn, "fc-token-rot")[0].style.transform
    );
    expect(a).not.toBe(b);
    expect(b).toContain("translate(9%,-9%)");
  });

  it("座位卡有飞机头像 + 4 个机位点亮图;选机按钮带缩略图", () => {
    const h = setup();
    const table = mountTable(h, { setup: [[GOAL, GOAL, 10, BASE], [], [], []] });
    cleanup.push(() => table.destroy());
    const seat = byClass(h.root, "fc-seat")[0];
    expect(seat.innerHTML).toContain("<svg");
    expect(seat.innerHTML).toContain(COLOR_INFO[0].name);
    expect(seat.innerHTML.split("fc-slot-on").length - 1).toBe(2);
    expect(seat.innerHTML).toContain('aria-label="到家 2/4"');
    const pick = byClass(h.root, "fc-pick")[0];
    expect(pick.innerHTML).toContain("fc-pick-thumb");
    expect(pick.innerHTML).toContain("<svg");
  });
});

describe("视觉契约 2 · 立体骰", () => {
  it("结算面点数与 settleRoll 收到的 value 一致(data-value + data-pips)", () => {
    const h = setup();
    const table = mountTable(h, { dice: [3, 2, 2, 2] });
    cleanup.push(() => table.destroy());
    const dice = byClass(h.root, "fc-dice")[0];
    expect(dice.innerHTML).toContain("<svg");
    h.press("f");
    vi.advanceTimersByTime(SETTLE);
    expect(dice.getAttribute("data-value")).toBe("3");
    expect(dice.innerHTML).toContain('data-pips="3"');
    expect(dice.getAttribute("aria-label")).toContain("3");
  });

  it("掷出 6:金边 + fc-dice-six 闪一次,闪完类摘掉", () => {
    const h = setup();
    const table = mountTable(h, { setup: [[BASE, BASE, BASE, BASE], [], [], []], dice: [6, 2, 2, 2] });
    cleanup.push(() => table.destroy());
    const dice = byClass(h.root, "fc-dice")[0];
    h.press("f");
    vi.advanceTimersByTime(SETTLE);
    expect(dice.getAttribute("data-value")).toBe("6");
    expect(dice.innerHTML).toContain('data-pips="6"');
    expect(dice.classList.contains("fc-dice-six")).toBe(true);
    vi.advanceTimersByTime(FLASH_MS + 60);
    expect(dice.classList.contains("fc-dice-six")).toBe(false);
  });
});

describe("视觉契约 3 · 起飞尾迹与逐格小跳", () => {
  it("起飞:两条拉烟尾迹挂上,0.4s 后收干净", () => {
    const h = setup();
    const table = mountTable(h, { setup: [[BASE, BASE, BASE, BASE], [], [], []], dice: [6, 2, 2, 2] });
    cleanup.push(() => table.destroy());
    h.press("f");
    vi.advanceTimersByTime(SETTLE);
    // 四架都能起飞,按 F 确认当前选中那架
    h.press("f");
    vi.advanceTimersByTime(30);
    expect(byClass(h.root, "fc-trail")).toHaveLength(1);
    expect(byClass(h.root, "fc-trail")[0].innerHTML).toContain("<svg");
    vi.advanceTimersByTime(3000);
    expect(byClass(h.root, "fc-trail")).toHaveLength(0);
    expect(h.classLog.has("fc-token-rise")).toBe(true);
  });

  it("普通走子逐格小跳(a/b 轮换),走完类全摘", () => {
    const h = setup();
    const table = mountTable(h, { dice: [3, 2, 2, 2] });
    cleanup.push(() => table.destroy());
    h.press("f");
    vi.advanceTimersByTime(SETTLE + BEAT_MS + HOP_MS * 4 + SHOT_MS + ARC_MS + CHUTE_MS + 2000);
    expect(h.classLog.has("fc-hop-a")).toBe(true);
    expect(h.classLog.has("fc-hop-b")).toBe(true);
    expect(byClass(h.root, "fc-hop-a")).toHaveLength(0);
    expect(byClass(h.root, "fc-hop-b")).toHaveLength(0);
    expect(byClass(h.root, "fc-token-move")).toHaveLength(0);
  });

  it("跳格/航线:飞机拉高 + 影子分离,落地后合并", () => {
    const h = setup();
    // p=12 本色格,掷 4 落 16(航线格)接着飞对角 —— 必然有一段大跳
    const table = mountTable(h, { setup: [[12, BASE, BASE, BASE], [], [], []], dice: [4, 2, 2, 2] });
    cleanup.push(() => table.destroy());
    h.press("f");
    vi.advanceTimersByTime(8000);
    expect(h.classLog.has("fc-token-lift")).toBe(true);
    expect(h.classLog.has("fc-shadow-off")).toBe(true);
    expect(byClass(h.root, "fc-token-lift")).toHaveLength(0);
    expect(byClass(h.root, "fc-shadow-off")).toHaveLength(0);
  });
});

describe("视觉契约 4 · 击落 = 打转 + 降落伞安全返航", () => {
  it("动画节点结束后清理,被击落棋子最终 left/top 与基地坐标一致", () => {
    const h = setup();
    // 朵朵 p=10 掷 3 落到环线 13 格,小花那架(行程 39)正停在那里 → 撞回基地
    const table = mountTable(h);
    cleanup.push(() => table.destroy());
    const victim = tokenOf(h, 2, 0);
    expect(victim.getAttribute("aria-label")).toBe(describePos(2, 39));
    h.press("f");
    vi.advanceTimersByTime(SETTLE + BEAT_MS + HOP_MS * 4 + SHOT_MS + ARC_MS + CHUTE_MS + 3000);
    // 打转、伞花、金边都真的播过
    expect(h.classLog.has("fc-token-shot")).toBe(true);
    expect(h.classLog.has("fc-chute-bloom")).toBe(true);
    expect(h.classLog.has("fc-token-gold")).toBe(true);
    // 播完全部收干净
    expect(byClass(h.root, "fc-chute")).toHaveLength(0);
    expect(byClass(h.root, "fc-token-shot")).toHaveLength(0);
    expect(byClass(h.root, "fc-token-gold")).toHaveLength(0);
    // 视觉-状态一致:回基地的那架 left/top 就是基地停机位坐标
    const pos = pctOf(tokenXY(2, BASE, 0));
    expect(victim.style.left).toBe(`${pos.left - CELL / 2}%`);
    expect(victim.style.top).toBe(`${pos.top - CELL / 2}%`);
    expect(victim.getAttribute("aria-label")).toBe(describePos(2, BASE));
    // 基地停机位真是 baseXY 给的那一格
    expect(tokenXY(2, BASE, 0)).toEqual(baseXY(2, 0));
  });
});

describe("视觉契约 5 · prefers-reduced-motion 全面降级", () => {
  it("逐格跳 / 拉高 / 打转 / 尾迹 / 金闪类一个都不加,位置仍与状态一致", () => {
    const h = setup({ reduced: true });
    const table = mountTable(h);
    cleanup.push(() => table.destroy());
    h.press("f");
    vi.advanceTimersByTime(8000);
    for (const cls of [
      "fc-hop-a",
      "fc-hop-b",
      "fc-token-lift",
      "fc-shadow-off",
      "fc-token-shot",
      "fc-token-rise",
      "fc-trail",
      "fc-chute",
      "fc-chute-bloom",
      "fc-token-gold",
      "fc-token-move",
      "fc-dice-six"
    ]) {
      expect(h.classLog.has(cls), `${cls} 在 reduced 下不该出现`).toBe(false);
    }
    // 被撞的那架照样回到基地坐标(降级只减动画,不减结果)
    const victim = tokenOf(h, 2, 0);
    const pos = pctOf(tokenXY(2, BASE, 0));
    expect(victim.style.left).toBe(`${pos.left - CELL / 2}%`);
    expect(victim.getAttribute("aria-label")).toBe(describePos(2, BASE));
  });
});

describe("视觉契约 6 · 终局烟花", () => {
  it("赢局先放塔台烟花(canvas 节点),放完移除再交结算;定时器不泄漏", () => {
    const h = setup();
    let over = 0;
    const table = mountTable(h, {
      setup: [[10, BASE, BASE, BASE], [], [], []],
      judge: () => "win",
      onOver: () => {
        over++;
      }
    });
    h.press("f");
    // 走完 3 格动画后进入烟花
    vi.advanceTimersByTime(SETTLE + BEAT_MS + HOP_MS * 4 + 200);
    expect(byClass(h.root, "fc-fireworks")).toHaveLength(1);
    expect(over).toBe(0);
    vi.advanceTimersByTime(FIREWORK_MS + 200);
    expect(byClass(h.root, "fc-fireworks")).toHaveLength(0);
    expect(over).toBe(1);
    table.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("视觉契约 7 · 盘面静态装饰层(1.3 r1 P3)", () => {
  it("装饰恰好 6 件(草地簇 ×4 + 塔台旁云 ×2),全部静态、透明度克制", () => {
    const art = decorArt();
    expect(art.split("fc-decor-grass").length - 1).toBe(4);
    expect(art.split("fc-decor-cloud").length - 1).toBe(2);
    expect(art).not.toContain("<animate");
    // 草地簇 opacity ≤ 0.35;两朵云远小近大(0.045 < 0.06)
    expect(art.split('class="fc-decor-grass" opacity=".35"').length - 1).toBe(4);
    expect(art.indexOf("scale(0.045)")).toBeLessThan(art.indexOf("scale(0.06)"));
  });

  it("装饰坐标全部避开环线格 / 终点通道格(不压任何 .fc-cell)", () => {
    const art = decorArt();
    const cells = [...RING_XY, ...HOME_XY.flat()];
    const spots = [...art.matchAll(/translate\(([\d.]+) ([\d.]+)\)/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2])
    }));
    expect(spots.length).toBe(6);
    for (const s of spots) {
      const clash = cells.some((c) => s.x >= c.x && s.x < c.x + 1 && s.y >= c.y && s.y < c.y + 1);
      expect(clash, `装饰 (${s.x},${s.y}) 压到了格子`).toBe(false);
    }
  });

  it("挂桌后装饰层真实存在:aria-hidden、盖在基地之上、格子之前", () => {
    const h = setup();
    const table = mountTable(h);
    // svg 节点用 setAttribute("class") 设类,walk 按属性找
    const layers: FakeEl[] = [];
    walk(h.root, (el) => {
      if (el.getAttribute("class") === "fc-decor") layers.push(el);
    });
    expect(layers).toHaveLength(1);
    expect(layers[0].getAttribute("aria-hidden")).toBe("true");
    expect(layers[0].innerHTML).toContain("fc-grass");
    expect(layers[0].innerHTML).toContain("fc-cloud");
    table.destroy();
  });
});
