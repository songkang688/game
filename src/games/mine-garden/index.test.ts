import { afterEach, describe, expect, it } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { GUESS, OPEN, indexOf } from "./board";
import { AI_TIER_HINTS, AI_TIER_LABELS, AI_TIERS } from "./ai";
import guide from "./guide";
import { allLevels, levelAt, loseLine, winLine } from "./levels";
import { installDom, type DomStub, type FakeEl } from "./testkit";
import { cloverSVG, flagSVG, flowerSVG, signSVG, wateringCanSVG, wreathSVG } from "./art";
import {
  AI_TICK_MS,
  LONG_PRESS_CHOICES,
  LONG_PRESS_MS,
  MAX_CELL,
  MG_CONSTS,
  MINI_COLORS,
  MN_CSS,
  MIN_CELL,
  MODE_LABELS,
  PRESETS,
  RIPPLE_STEP_MS,
  bloomStepMs,
  cellPx,
  clockText,
  endlessLine,
  endlessMines,
  flipMs,
  flowerStage,
  hintColor,
  keyAction,
  levelNote,
  levelRunOptions,
  longPressProgress,
  meta,
  mount,
  mountField,
  needsScroll,
  nextLongPress,
  percentText,
  reducedMotion,
  seedSpec,
  viewportWidth
} from "./index";

let dom: DomStub | null = null;

afterEach(() => {
  dom?.restore();
  dom = null;
});

function fakeApi(root: unknown): Parameters<typeof mount>[0] {
  return {
    root: root as HTMLElement,
    play: () => undefined,
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined
  };
}

/** 手指点一下：按下再抬起 */
function tap(cell: FakeEl): void {
  cell.fire("pointerdown", { button: 0 });
  cell.fire("pointerup", { button: 0 });
}

/**
 * 额外模式挂在 `mn-wrap` 的第 4 个孩子里（style / 模式条 / 闯关 / 额外模式）。
 * 闯关那一份只是 hidden，并没有从树上摘掉，所以找按钮必须缩到这一块里找。
 */
function modeHost(stub: DomStub): FakeEl {
  return stub.root.children[0].children[3];
}

describe("mine-garden · meta 是纯数据卡片", () => {
  it("按规格逐字落地", () => {
    expect(meta.id).toBe("mine-garden");
    expect(meta.title).toBe("扫雷花园");
    expect(meta.emoji).toBe("🌼");
    expect(meta.category).toBe("casual");
    expect(meta.color).toBe("#E5F8D8");
    expect(meta.blurb).toBe("看数字绕开刺种。第一下一定安全，插好小旗，把整片花园都翻开。");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("mobile");
  });

  it("四种模式都是壳认识的模式名", () => {
    expect([...meta.modes]).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
    for (const m of meta.modes) expect(GAME_MODES as readonly string[]).toContain(m);
  });

  it("三个额外模式的入口都在", () => {
    expect(Object.keys(MODE_LABELS)).toEqual(["versus", "endless", "duo"]);
    expect(MODE_LABELS.duo).toContain("双人");
    expect(AI_TICK_MS).toBeGreaterThan(0);
  });
});

describe("mine-garden · 360px 下的格子", () => {
  it("窄屏上格子永远 ≥ 28px", () => {
    expect(MIN_CELL).toBe(28);
    for (const cols of [5, 9, 10, 16, 20, 30]) {
      expect(cellPx(cols, 360), `${cols} 列`).toBeGreaterThanOrEqual(28);
      expect(cellPx(cols, 320), `${cols} 列窄屏`).toBeGreaterThanOrEqual(28);
    }
  });

  it("小图不会把格子撑得满屏都是", () => {
    expect(cellPx(5, 1200)).toBeLessThanOrEqual(MAX_CELL);
  });

  it("9×9 在 360px 上完整入屏，30 列的高级图要横着拖", () => {
    expect(needsScroll(9, 360)).toBe(false);
    expect(needsScroll(30, 360)).toBe(true);
    expect(cellPx(30, 360) * 30).toBeGreaterThan(360);
  });

  it("宽度读不出来时按 320 兜底，视口宽度也有兜底", () => {
    expect(cellPx(9, 0)).toBeGreaterThanOrEqual(28);
    expect(cellPx(9, Number.NaN)).toBeGreaterThanOrEqual(28);
    expect(viewportWidth()).toBeGreaterThan(0);
  });
});

describe("mine-garden · 键位", () => {
  it("单人：方向键和 WASD 都能挪，F 翻开、G 插旗、Esc 暂停", () => {
    expect(keyAction("ArrowUp")).toBe("up");
    expect(keyAction("w")).toBe("up");
    expect(keyAction("S")).toBe("down");
    expect(keyAction("ArrowLeft")).toBe("left");
    expect(keyAction("d")).toBe("right");
    expect(keyAction("f")).toBe("open");
    expect(keyAction("F")).toBe("open");
    expect(keyAction("g")).toBe("flag");
    expect(keyAction("Escape")).toBe("pause");
    expect(keyAction("q")).toBeNull();
  });

  it("双人：朵朵 WASD+F+G，星星 方向键+L+K，互不串台", () => {
    expect(keyAction("w", "p1")).toBe("up");
    expect(keyAction("f", "p1")).toBe("open");
    expect(keyAction("g", "p1")).toBe("flag");
    expect(keyAction("ArrowUp", "p1")).toBeNull();
    expect(keyAction("l", "p1")).toBeNull();

    expect(keyAction("ArrowDown", "p2")).toBe("down");
    expect(keyAction("l", "p2")).toBe("open");
    expect(keyAction("k", "p2")).toBe("flag");
    expect(keyAction("w", "p2")).toBeNull();
    expect(keyAction("f", "p2")).toBeNull();
  });

  it("两边的 Esc 都能暂停，关掉键盘的那一份只留 Esc", () => {
    expect(keyAction("Escape", "p1")).toBe("pause");
    expect(keyAction("Escape", "p2")).toBe("pause");
    expect(keyAction("Escape", "none")).toBe("pause");
    expect(keyAction("f", "none")).toBeNull();
  });
});

describe("mine-garden · 长按插旗", () => {
  it("进度环从 0 走到 1，越界会夹住", () => {
    expect(longPressProgress(0)).toBe(0);
    expect(longPressProgress(LONG_PRESS_MS / 2)).toBeCloseTo(0.5, 5);
    expect(longPressProgress(LONG_PRESS_MS)).toBe(1);
    expect(longPressProgress(9999)).toBe(1);
    expect(longPressProgress(-5)).toBe(0);
    expect(longPressProgress(10, 0)).toBe(1);
  });

  it("阈值写成常量，设置里能在三档之间循环切", () => {
    expect(LONG_PRESS_CHOICES).toHaveLength(3);
    expect(LONG_PRESS_CHOICES).toContain(LONG_PRESS_MS);
    let cur = LONG_PRESS_CHOICES[0];
    const seen = new Set<number>();
    for (let i = 0; i < 3; i++) {
      seen.add(cur);
      cur = nextLongPress(cur);
    }
    expect(seen.size).toBe(3);
    expect(cur).toBe(LONG_PRESS_CHOICES[0]);
  });
});

describe("mine-garden · 显示小工具", () => {
  it("数字 1–8 各有一个颜色", () => {
    const colors = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(hintColor));
    expect(colors.size).toBe(8);
    expect(MG_CONSTS.hintColors).toHaveLength(8);
    expect(hintColor(99)).toBe(hintColor(8));
  });

  it("计时按 mm:ss 显示，负数按 0 算", () => {
    expect(clockText(0)).toBe("00:00");
    expect(clockText(65000)).toBe("01:05");
    expect(clockText(-1000)).toBe("00:00");
    expect(clockText(600000)).toBe("10:00");
  });

  it("完成度显示成百分数", () => {
    expect(percentText(0)).toBe("0%");
    expect(percentText(0.5)).toBe("50%");
    expect(percentText(1.4)).toBe("100%");
  });

  it("省电模式下动画缩到最短，但一颗一颗开花的顺序还在", () => {
    expect(flipMs(true)).toBeLessThan(flipMs(false));
    expect(bloomStepMs(true)).toBeLessThan(bloomStepMs(false));
    expect(bloomStepMs(true)).toBeGreaterThan(0);
    expect(typeof reducedMotion()).toBe("boolean");
  });

  it("样式表里写了 360px 的窄屏规则和省电模式规则", () => {
    expect(MN_CSS).toContain("max-width:420px");
    expect(MN_CSS).toContain("prefers-reduced-motion");
  });

  // W1-05:这一款以前和 `merge-2048` 共用 `mg-` 前缀,`.mg-open` 在两边含义还相反。
  // 眼下样式各自塞在根节点里所以不会真串味,但只要谁把样式提到 styles.css 就会互相改样子。
  it("类名一律走自己的 mn- 前缀,一个 mg- 都不剩", () => {
    expect(MN_CSS).not.toContain("mg-");
    expect(MN_CSS).not.toContain("mgflip");
    expect(MN_CSS).not.toContain("mgbloom");
    expect(MN_CSS).toContain(".mn-cell");
  });

  // W1-06:「← 回闯关 / ← 换难度」以前也顶着 .mg-open,按类名找入口的自动化会被带回选关页
  it("返回键有自己的 mn-back,不和模式入口 mn-open 混在一起", () => {
    expect(MN_CSS).toContain(".mn-back");
    // 「翻开的格子」也从 -open 里挪走,免得一个类名同时是按钮又是格子状态
    expect(MN_CSS).toContain(".mn-cell.mn-lit");
    expect(MN_CSS).not.toContain(".mn-cell.mn-open");
  });
});

describe("mine-garden · 无尽与难度预设", () => {
  it("三档预设就是规格里那三档", () => {
    expect(PRESETS.map((p) => `${p.w}x${p.h}/${p.mines}`)).toEqual(["9x9/10", "16x16/40", "30x16/99"]);
  });

  it("每清一盘密度 +1，而且永远留得下空地", () => {
    const p = PRESETS[0];
    expect(endlessMines(0, p)).toBe(10);
    expect(endlessMines(3, p)).toBe(13);
    expect(endlessMines(9999, p)).toBeLessThan(p.w * p.h);
    expect(endlessLine(2, 5, 12)).toContain("最好成绩 5");
    expect(endlessLine(7, 5, 12)).toContain("最好成绩 7");
  });
});

describe("mine-garden · 一片花园（真点、真赢、真输）", () => {
  it("按尺寸铺满格子，HUD 三块信息都在", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 5,
      mines: 4,
      seed: 5,
      sfx: () => undefined
    });
    expect(dom.root.byClass("mn-cell")).toHaveLength(30);
    const chips = dom.root.byClass("mn-chip").map((c) => c.textContent);
    expect(chips.some((t) => t.includes("🚩"))).toBe(true);
    expect(chips.some((t) => t.includes("⏱"))).toBe(true);
    expect(chips.some((t) => t.includes("🌼"))).toBe(true);
    field.destroy();
  });

  it("第一下一定安全，之后把非刺种格点完就赢", () => {
    dom = installDom();
    let ended: { win: boolean; ms: number } | null = null;
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 5,
      seed: 31,
      noGuess: true,
      sfx: () => undefined,
      autoSettle: false,
      onEnd: (info) => {
        ended = info;
      }
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    expect(field.run.started).toBe(true);
    expect(field.run.board.mines).toBe(5);
    for (let i = 0; i < 36; i++) {
      if (!field.run.board.mine[i] && field.run.board.state[i] !== OPEN) tap(cells[i]);
    }
    expect(field.run.phase).toBe("won");
    expect(ended).not.toBeNull();
    expect((ended as unknown as { win: boolean }).win).toBe(true);
    field.destroy();
  });

  it("踩到刺种就收场，剩下的刺种一颗一颗慢慢开花", () => {
    dom = installDom();
    let ended: { win: boolean; reason: string } | null = null;
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 6,
      seed: 12,
      sfx: () => undefined,
      autoSettle: false,
      onEnd: (info) => {
        ended = info;
      }
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    const spike = field.run.board.mine.indexOf(1);
    tap(cells[spike]);
    expect(field.run.phase).toBe("lost");
    expect((ended as unknown as { reason: string }).reason).toBe("hit");
    // 其余刺种还排着队，flush 之后才全部开花
    const bloomBefore = dom.root.byClass("mn-bloom").length;
    dom.flush();
    expect(dom.root.byClass("mn-bloom").length).toBeGreaterThan(bloomBefore);
    field.destroy();
  });

  it("右键插旗；插了旗的格子点不动", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 5,
      seed: 8,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    const spike = field.run.board.mine.indexOf(1);
    cells[spike].fire("contextmenu");
    expect(cells[spike].textContent).toBe("🚩");
    tap(cells[spike]);
    expect(field.run.phase).toBe("playing");
    field.destroy();
  });

  it("长按就是插旗：按住不放，进度环走满那一刻旗子出现", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 5,
      seed: 8,
      longPressMs: 0,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    const spike = field.run.board.mine.indexOf(1);
    cells[spike].fire("pointerdown", { button: 0 });
    dom.frame();
    expect(cells[spike].textContent).toBe("🚩");
    // 长按已经插了旗，抬手不再当作「翻开」
    cells[spike].fire("pointerup", { button: 0 });
    expect(field.run.phase).toBe("playing");
    field.destroy();
  });

  it("键盘也能玩：方向键挪光标，F 翻开，G 插旗", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 5,
      seed: 3,
      sfx: () => undefined,
      autoSettle: false
    });
    const start = field.run.cursor;
    dom.press("ArrowRight");
    expect(field.run.cursor).toBe(start + 1);
    dom.press("ArrowDown");
    expect(field.run.cursor).toBe(start + 7);
    dom.press("f");
    expect(field.run.started).toBe(true);
    const hidden = field.run.board.state.indexOf(0);
    field.run.cursor = hidden;
    dom.press("g");
    expect(field.run.board.state[hidden]).toBe(2);
    field.destroy();
  });

  it("Esc 暂停会把计时停住，再按一下接着走", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 5,
      seed: 3,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    dom.press("Escape");
    const paused = dom.root.findText("计时停住");
    expect(paused).not.toBeNull();
    const before = field.elapsed();
    // 暂停期间点格子不生效
    const hidden = field.run.board.state.indexOf(0);
    tap(cells[hidden]);
    expect(field.run.board.state[hidden]).toBe(0);
    expect(field.elapsed()).toBeGreaterThanOrEqual(before - 1);
    dom.press("Escape");
    tap(cells[hidden]);
    expect(field.run.board.state[hidden]).not.toBe(0);
    field.destroy();
  });

  it("限旗关插满就插不动，HUD 会变成告警色", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 5,
      seed: 17,
      flagLimit: 1,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    const hidden: number[] = [];
    for (let i = 0; i < 36; i++) if (field.run.board.state[i] === 0) hidden.push(i);
    cells[hidden[0]].fire("contextmenu");
    cells[hidden[1]].fire("contextmenu");
    expect(cells[hidden[1]].textContent).not.toBe("🚩");
    expect(dom.root.findText("小旗用完")).not.toBeNull();
    expect(dom.root.byClass("mn-warn").length).toBeGreaterThan(0);
    field.destroy();
  });

  it("迷雾只挡显示不挡判定：看不见的格子照样点得开、照样能赢", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 4,
      seed: 23,
      fog: true,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[0]);
    expect(dom.root.byClass("mn-dark").length).toBeGreaterThan(0);
    for (let i = 0; i < 36; i++) {
      if (!field.run.board.mine[i] && field.run.board.state[i] !== OPEN) tap(cells[i]);
    }
    expect(field.run.phase).toBe("won");
    field.destroy();
  });

  it("30 列的大图会给出迷你地图和「横着拖」的提示", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 30,
      h: 16,
      mines: 99,
      seed: 4,
      sfx: () => undefined,
      autoSettle: false
    });
    const tip = dom.root.byClass("mn-minitip")[0];
    expect(tip.hidden).toBe(false);
    expect(dom.root.byClass("mn-mini")[0].hidden).toBe(false);
    field.destroy();
  });

  it("destroy 之后监听器和定时器一个不剩", () => {
    dom = installDom();
    const before = dom.globalCount();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 9,
      h: 9,
      mines: 10,
      seed: 9,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(9, 4, 4)]);
    expect(dom.globalCount()).toBeGreaterThan(before);
    expect(dom.timerCount()).toBeGreaterThan(0);
    field.destroy();
    expect(dom.globalCount()).toBe(before);
    expect(dom.timerCount()).toBe(0);
    expect(dom.root.byClass("mn-cell")).toHaveLength(0);
  });
});

describe("mine-garden · 闯关接线", () => {
  it("关卡参数原样接到一局里", () => {
    const lv = levelAt(120);
    const opts = levelRunOptions(lv);
    expect(opts.w).toBe(lv.w);
    expect(opts.mines).toBe(lv.mines);
    expect(opts.noGuess).toBe(lv.noGuess);
    expect(opts.timeLimitMs).toBe(lv.timeLimitMs);
    expect(levelRunOptions(lv, 1).seed).not.toBe(opts.seed);
  });

  it("关卡说明会把这一关的特别之处写出来", () => {
    expect(levelNote(levelAt(0))).toContain("有一次保护");
    expect(levelNote(levelAt(50))).toContain("练和弦");
    expect(levelNote(levelAt(100))).toContain("有雾");
    expect(levelNote(levelAt(120))).toContain("限时");
    expect(levelNote(levelAt(60))).toContain("保证能算出来");
  });

  it("mount 之后三个模式入口 + 188 关地图都在，destroy 收得干净", () => {
    dom = installDom();
    const before = dom.globalCount();
    const handle = mount(fakeApi(dom.root));
    const texts = dom.root.buttonTexts();
    for (const label of Object.values(MODE_LABELS)) {
      expect(texts.some((t) => t.includes(label))).toBe(true);
    }
    expect(dom.root.findText("188")).not.toBeNull();
    handle.destroy();
    expect(dom.globalCount()).toBe(before);
    expect(dom.timerCount()).toBe(0);
  });

  it("从地图点「开始冒险」能真的打开第 1 关的花园", () => {
    dom = installDom();
    const handle = mount(fakeApi(dom.root));
    const start = dom.root.button("开始冒险");
    expect(start).not.toBeNull();
    start?.fire("click");
    expect(dom.root.byClass("mn-cell").length).toBe(levelAt(0).w * levelAt(0).h);
    expect(dom.root.findText("小苗床")).not.toBeNull();
    handle.destroy();
    expect(dom.timerCount()).toBe(0);
  });

  it("竞速对战 / 连续清盘 / 双人同屏都能进得去、退得出", () => {
    for (const label of Object.values(MODE_LABELS)) {
      dom?.restore();
      dom = installDom();
      const before = dom.globalCount();
      const handle = mount(fakeApi(dom.root));
      dom.root.button(label)?.fire("click");
      const host = modeHost(dom);
      expect(host.button("开始"), `${label} 少了开始按钮`).not.toBeNull();
      expect(host.button("初级 9×9"), `${label} 少了难度选择`).not.toBeNull();
      host.button("← 回闯关")?.fire("click");
      handle.destroy();
      expect(dom.globalCount()).toBe(before);
      expect(dom.timerCount()).toBe(0);
    }
  });

  it("竞速对战真开一局：同一张图，假人的进度条会自己往前走", () => {
    dom = installDom();
    const handle = mount(fakeApi(dom.root));
    dom.root.button(MODE_LABELS.versus)?.fire("click");
    modeHost(dom).button("开始竞速")?.fire("click");
    const cells = modeHost(dom).byClass("mn-cell");
    expect(cells.length).toBe(81);
    tap(cells[indexOf(9, 4, 4)]);
    const bar = dom.root.byClass("mn-bar")[0];
    expect(bar).toBeTruthy();
    expect(dom.timerCount()).toBeGreaterThan(0);
    handle.destroy();
    expect(dom.timerCount()).toBe(0);
  });

  it("双人同屏左右两块地是同一张图，键位各管各的", () => {
    dom = installDom();
    const handle = mount(fakeApi(dom.root));
    dom.root.button(MODE_LABELS.duo)?.fire("click");
    modeHost(dom).button("开始 ▶")?.fire("click");
    const fields = modeHost(dom).byClass("mn-field");
    expect(fields).toHaveLength(2);
    expect(fields[0].findText("朵朵")).not.toBeNull();
    expect(fields[1].findText("星星")).not.toBeNull();
    // 朵朵按 D 只挪左边，星星按方向键只挪右边
    const leftCells = fields[0].byClass("mn-cell");
    tap(leftCells[indexOf(9, 4, 4)]);
    // 翻开的格子挂的是 mn-lit(不再和「模式入口按钮」共用 mn-open)
    expect(fields[0].byClass("mn-lit").length).toBeGreaterThan(0);
    expect(fields[1].byClass("mn-lit")).toHaveLength(0);
    handle.destroy();
    expect(dom.timerCount()).toBe(0);
  });
});

describe("mine-garden · 分级红线自审", () => {
  const BAD = ["地雷", "爆炸", "炸", "战争", "伤亡", "死", "血", "尸", "杀"];

  function visibleStrings(): string[] {
    const out: string[] = [meta.title, meta.blurb, guide.title];
    out.push(...Object.values(MODE_LABELS));
    out.push(...Object.values(AI_TIER_LABELS));
    out.push(...Object.values(AI_TIER_HINTS));
    out.push(...PRESETS.map((p) => p.label));
    out.push(...guide.general);
    for (const e of guide.entries) {
      out.push(e.title, ...e.tips);
    }
    for (const lv of allLevels()) out.push(lv.title, lv.task, levelNote(lv));
    out.push(winLine(levelAt(0), 3, 1000), winLine(levelAt(0), 1, 1000), loseLine("hit"), loseLine("time"));
    return out;
  }

  it("看得见的文案里一个吓人的字都没有", () => {
    for (const line of visibleStrings()) {
      for (const w of BAD) {
        expect(line.includes(w), `「${line}」里出现了「${w}」`).toBe(false);
      }
    }
  });

  it("该出现的温柔说法都在：刺种 / 插旗 / 开花", () => {
    const all = visibleStrings().join(" ");
    expect(all).toContain("刺种");
    expect(all).toContain("插旗");
    expect(all).toContain("小旗");
    expect(meta.blurb).toContain("第一下一定安全");
  });

  it("四档假人的说明也是温柔口径", () => {
    for (const t of AI_TIERS) {
      for (const w of BAD) expect(AI_TIER_HINTS[t].includes(w)).toBe(false);
    }
  });

  it("攻略覆盖第 1 关到第 188 关，一段都不漏", () => {
    expect(guide.gameId).toBe("mine-garden");
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
    for (let i = 1; i < guide.entries.length; i++) {
      expect(guide.entries[i].from).toBe(guide.entries[i - 1].to + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// 1.3 视觉升级契约:格子/旗/花全部换成画的,波纹连开,鸟瞰小地图
// ---------------------------------------------------------------------------

describe("mine-garden · 1.3 视觉契约", () => {
  /** 格子里第一棵 `<svg>`（DOM 替身没有 createElementNS,退回 createElement 也长成 tag=svg） */
  function svgOf(cell: FakeEl): FakeEl | undefined {
    return cell.children.find((ch) => ch.tag === "svg");
  }

  function plainField(w = 6, h = 6, mines = 5, seed = 8): ReturnType<typeof mountField> {
    return mountField((dom as DomStub).root as unknown as HTMLElement, {
      w,
      h,
      mines,
      seed,
      sfx: () => undefined,
      autoSettle: false
    });
  }

  it("旗格里是 SVG 木杆小旗,emoji 只活在 <title> 里", () => {
    dom = installDom();
    const field = plainField();
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    const spike = field.run.board.mine.indexOf(1);
    cells[spike].fire("contextmenu");
    const svg = svgOf(cells[spike]);
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("class")).toBe("mn-i-flag");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.children.some((ch) => ch.tag === "title")).toBe(true);
    // 兼容口径:textContent 仍是「🚩」(来自 <title>),但已不是纯文本节点
    expect(cells[spike].textContent).toBe("🚩");
    expect(cells[spike].children.length).toBeGreaterThan(0);
    field.destroy();
  });

  it("输局揭开后,每颗刺种格里都是 SVG 花朵节点,不是 emoji 文本", () => {
    dom = installDom();
    const field = plainField(6, 6, 6, 12);
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    tap(cells[field.run.board.mine.indexOf(1)]);
    dom.flush();
    const blooms = dom.root.byClass("mn-bloom");
    expect(blooms.length).toBeGreaterThan(1);
    for (const b of blooms) {
      const svg = svgOf(b);
      expect(svg?.getAttribute("class")).toBe("mn-i-flower");
      expect(b.children.length).toBeGreaterThan(0);
    }
    field.destroy();
  });

  it("问号是木牌 SVG,结算时插错的旗换成四叶草 SVG", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 5,
      seed: 17,
      useGuess: true,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    const b = field.run.board;
    // 键盘 g 两下 → 问号(绕开右键双发去重窗)
    let hidden = -1;
    for (let i = 0; i < 36; i++) {
      if (b.state[i] === 0) {
        hidden = i;
        break;
      }
    }
    field.run.cursor = hidden;
    dom.press("g");
    dom.press("g");
    expect(b.state[hidden]).toBe(GUESS);
    expect(svgOf(cells[hidden])?.getAttribute("class")).toBe("mn-i-guess");
    // 插错一面旗再踩雷:结算后错旗换四叶草
    let wrong = -1;
    for (let i = 0; i < 36; i++) {
      if (b.state[i] === 0 && !b.mine[i]) {
        wrong = i;
        break;
      }
    }
    cells[wrong].fire("contextmenu");
    tap(cells[b.mine.indexOf(1)]);
    expect(field.run.phase).toBe("lost");
    expect(svgOf(cells[wrong])?.getAttribute("class")).toBe("mn-i-clover");
    expect(cells[wrong].className).toContain("mn-wrong");
    field.destroy();
  });

  it("凸/凹双态:未开格带草皮纹理与棋盘两档草色,翻开格是内凹泥土", () => {
    dom = installDom();
    const field = plainField();
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    dom.flush();
    const lit = cells.filter((c) => c.className.includes("mn-lit"));
    const turf = cells.filter((c) => /\bmn-t[0-2]\b/.test(c.className));
    expect(lit.length).toBeGreaterThan(0);
    expect(turf.length).toBeGreaterThan(0);
    expect(turf.some((c) => c.className.includes("mn-g0"))).toBe(true);
    expect(turf.some((c) => c.className.includes("mn-g1"))).toBe(true);
    // 凸:未开格顶部 1px 高光;凹:翻开格内凹阴影
    expect(MN_CSS).toContain("inset 0 1px 0 rgba(255,255,255");
    expect(MN_CSS).toMatch(/\.mn-cell\.mn-lit\{[^}]*inset 0 2px 3px/);
    field.destroy();
  });

  it("大片连开走波纹队列:起点先亮,其余按圈排队,destroy 一并清空", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 9,
      h: 9,
      mines: 10,
      seed: 9,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    const b = field.run.board;
    const countOpen = (): number => {
      let n = 0;
      for (let i = 0; i < 81; i++) if (b.state[i] === OPEN) n++;
      return n;
    };
    tap(cells[indexOf(9, 4, 4)]);
    if (countOpen() <= 2) {
      for (let i = 0; i < 81; i++) {
        if (!b.mine[i] && b.state[i] !== OPEN && b.hint[i] === 0) {
          tap(cells[i]);
          break;
        }
      }
    }
    const logical = countOpen();
    expect(logical).toBeGreaterThan(2);
    // 视觉上只有起点即时翻开,其余还排着队
    expect(dom.root.byClass("mn-lit").length).toBeLessThan(logical);
    expect(dom.timerCount()).toBeGreaterThan(1);
    dom.flush();
    expect(dom.root.byClass("mn-lit").length).toBe(logical);
    // 再连开一片就 destroy:队列挂在 timers 篮子里,一并清空
    for (let i = 0; i < 81; i++) {
      if (!b.mine[i] && b.state[i] !== OPEN && b.hint[i] === 0) {
        tap(cells[i]);
        break;
      }
    }
    field.destroy();
    expect(dom.timerCount()).toBe(0);
    expect(RIPPLE_STEP_MS).toBeGreaterThan(0);
    expect(MG_CONSTS.ripple).toBe(RIPPLE_STEP_MS);
  });

  it("弱动效下连开一次到位,不排视觉队列", () => {
    dom = installDom();
    const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
    g.matchMedia = () => ({ matches: true });
    try {
      const field = mountField(dom.root as unknown as HTMLElement, {
        w: 9,
        h: 9,
        mines: 10,
        seed: 9,
        sfx: () => undefined,
        autoSettle: false
      });
      const cells = dom.root.byClass("mn-cell");
      const b = field.run.board;
      tap(cells[indexOf(9, 4, 4)]);
      for (let i = 0; i < 81; i++) {
        if (!b.mine[i] && b.state[i] !== OPEN && b.hint[i] === 0) {
          tap(cells[i]);
          break;
        }
      }
      let logical = 0;
      for (let i = 0; i < 81; i++) if (b.state[i] === OPEN) logical++;
      expect(logical).toBeGreaterThan(2);
      expect(dom.root.byClass("mn-lit").length).toBe(logical);
      field.destroy();
    } finally {
      delete g.matchMedia;
    }
  });

  it("aria-label 逐格保留,文案口径一字不变", () => {
    dom = installDom();
    const field = plainField();
    const cells = dom.root.byClass("mn-cell");
    expect(cells[0].getAttribute("aria-label")).toBe("第 1 行第 1 列，还没翻开");
    tap(cells[indexOf(6, 3, 3)]);
    const b = field.run.board;
    const spike = b.mine.indexOf(1);
    cells[spike].fire("contextmenu");
    expect(cells[spike].getAttribute("aria-label")).toBe(
      `第 ${Math.floor(spike / 6) + 1} 行第 ${(spike % 6) + 1} 列，插着小旗`
    );
    let numIdx = -1;
    for (let i = 0; i < 36; i++) {
      if (b.state[i] === OPEN && b.hint[i] > 0 && !b.mine[i]) {
        numIdx = i;
        break;
      }
    }
    expect(numIdx).toBeGreaterThanOrEqual(0);
    expect(cells[numIdx].getAttribute("aria-label")).toBe(
      `第 ${Math.floor(numIdx / 6) + 1} 行第 ${(numIdx % 6) + 1} 列，${b.hint[numIdx]} 颗刺种`
    );
    field.destroy();
  });

  it("小地图鸟瞰三种状态三种颜色(canvas 替身钉 fillStyle 序列)", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 30,
      h: 16,
      mines: 99,
      seed: 4,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    const mini = dom.root.byClass("mn-mini")[0];
    const fills: string[] = [];
    const stub = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      clearRect: () => undefined,
      strokeRect: () => undefined,
      fillRect(): void {
        fills.push(String(this.fillStyle));
      }
    };
    (mini as unknown as { getContext: () => typeof stub }).getContext = () => stub;
    tap(cells[indexOf(30, 5, 5)]);
    const b = field.run.board;
    let flagIdx = -1;
    for (let i = 0; i < b.state.length; i++) {
      if (b.state[i] === 0) {
        flagIdx = i;
        break;
      }
    }
    fills.length = 0;
    cells[flagIdx].fire("contextmenu");
    expect(fills).toContain(MINI_COLORS.turf);
    expect(fills).toContain(MINI_COLORS.soil);
    expect(fills).toContain(MINI_COLORS.flag);
    expect(new Set(fills).size).toBeGreaterThanOrEqual(3);
    expect(dom.root.byClass("mn-minitip")[0].textContent).toContain("花园鸟瞰");
    field.destroy();
  });

  it("数字格底部有种子点:数量×形状双通道,1–8 档互不重复", () => {
    const combos = new Set<string>();
    for (let n = 1; n <= 8; n++) {
      const s = seedSpec(n);
      expect(s.count).toBeGreaterThanOrEqual(1);
      expect(s.count).toBeLessThanOrEqual(3);
      expect(s.shape).toBeGreaterThanOrEqual(0);
      expect(s.shape).toBeLessThanOrEqual(2);
      combos.add(`${s.shape}:${s.count}`);
    }
    expect(combos.size).toBe(8);

    dom = installDom();
    const field = plainField();
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    dom.flush();
    const b = field.run.board;
    let numIdx = -1;
    for (let i = 0; i < 36; i++) {
      if (b.state[i] === OPEN && b.hint[i] > 0) {
        numIdx = i;
        break;
      }
    }
    expect(numIdx).toBeGreaterThanOrEqual(0);
    const seeds = cells[numIdx].byClass("mn-seeds")[0];
    expect(seeds).toBeTruthy();
    const spec = seedSpec(b.hint[numIdx]);
    expect(seeds.children).toHaveLength(spec.count);
    expect(seeds.className).toContain(`mn-sh${spec.shape}`);
    field.destroy();
  });

  /** 打到只剩最后一颗安全格,返回它的下标(用来钉「胜利那一下」前后的定时器数) */
  function openUntilOneLeft(field: ReturnType<typeof mountField>, cells: FakeEl[]): number {
    const b = field.run.board;
    const remaining = (): number[] => {
      const out: number[] = [];
      for (let i = 0; i < b.state.length; i++) if (!b.mine[i] && b.state[i] !== OPEN) out.push(i);
      return out;
    };
    tap(cells[indexOf(6, 3, 3)]);
    let rest = remaining();
    while (rest.length > 1 && field.run.phase === "playing") {
      tap(cells[rest[0]]);
      rest = remaining();
    }
    expect(field.run.phase).toBe("playing");
    expect(rest).toHaveLength(1);
    return rest[0];
  }

  it("胜利排出花开波(弱动效整波关掉),结算面板配大花环", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 5,
      seed: 31,
      noGuess: true,
      sfx: () => undefined
    });
    const cells = dom.root.byClass("mn-cell");
    const last = openUntilOneLeft(field, cells);
    const before = dom.timerCount();
    tap(cells[last]);
    expect(field.run.phase).toBe("won");
    expect(dom.timerCount()).toBeGreaterThan(before);
    const art = dom.root.byClass("mn-over-art")[0];
    expect(art).toBeTruthy();
    expect(art.children[0].textContent).toBe(wreathSVG().title);
    field.destroy();
    expect(dom.timerCount()).toBe(0);

    // 弱动效:同一套流程一朵花都不排
    dom.restore();
    dom = installDom();
    const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
    g.matchMedia = () => ({ matches: true });
    try {
      const f2 = mountField(dom.root as unknown as HTMLElement, {
        w: 6,
        h: 6,
        mines: 5,
        seed: 31,
        noGuess: true,
        sfx: () => undefined
      });
      const cs = dom.root.byClass("mn-cell");
      const l2 = openUntilOneLeft(f2, cs);
      const before2 = dom.timerCount();
      tap(cs[l2]);
      expect(f2.run.phase).toBe("won");
      expect(dom.timerCount()).toBe(before2);
      f2.destroy();
    } finally {
      delete g.matchMedia;
    }
  });

  it("失败结算面板配浇水壶插画,口径依旧温柔", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 6,
      seed: 12,
      sfx: () => undefined
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[indexOf(6, 3, 3)]);
    tap(cells[field.run.board.mine.indexOf(1)]);
    const art = dom.root.byClass("mn-over-art")[0];
    expect(art).toBeTruthy();
    expect(art.children[0].textContent).toBe(wateringCanSVG().title);
    expect(dom.root.findText("没扫完")).not.toBeNull();
    field.destroy();
  });

  it("迷雾格不带草皮/石子纹理类,内容清空,质感不泄露", () => {
    dom = installDom();
    const field = mountField(dom.root as unknown as HTMLElement, {
      w: 6,
      h: 6,
      mines: 4,
      seed: 23,
      fog: true,
      sfx: () => undefined,
      autoSettle: false
    });
    const cells = dom.root.byClass("mn-cell");
    tap(cells[0]);
    dom.flush();
    const darks = cells.filter((c) => c.className.includes("mn-dark"));
    expect(darks.length).toBeGreaterThan(0);
    for (const d of darks) {
      expect(d.className).not.toMatch(/mn-[gts]\d/);
      if (!d.className.includes("mn-flag")) {
        expect(d.textContent).toBe("");
        expect(d.children).toHaveLength(0);
      }
    }
    field.destroy();
  });

  it("art.ts 全是纯函数:同参同出,浇水壶 ≤15 笔,盛开的花有五片花瓣", () => {
    expect(JSON.stringify(flowerSVG(2))).toBe(JSON.stringify(flowerSVG(2)));
    expect(JSON.stringify(flagSVG())).toBe(JSON.stringify(flagSVG()));
    expect(flowerSVG(2).shapes.filter((s) => s.attrs["data-part"] === "petal")).toHaveLength(5);
    expect(cloverSVG().shapes.filter((s) => s.attrs["data-part"] === "leaf")).toHaveLength(4);
    expect(wateringCanSVG().shapes.length).toBeLessThanOrEqual(15);
    for (const icon of [flowerSVG(0), flowerSVG(1), flowerSVG(2), flagSVG(), cloverSVG(), signSVG(), wreathSVG(), wateringCanSVG()]) {
      expect(icon.shapes.length).toBeGreaterThan(0);
      expect(icon.title.length).toBeGreaterThan(0);
      expect(icon.viewBox).toBe("0 0 24 24");
    }
    expect(flowerStage(0)).toBe(0);
    expect(flowerStage(0.5)).toBe(1);
    expect(flowerStage(1)).toBe(2);
  });

  it("新增动画全部接入弱动效开关,样式表带草皮/种子/花开波声明", () => {
    expect(MN_CSS).toContain("@keyframes mnturn");
    expect(MN_CSS).toContain("@keyframes mnplant");
    expect(MN_CSS).toContain("@keyframes mnpop");
    expect(MN_CSS).toContain(".mn-seeds");
    expect(MN_CSS).toContain(".mn-cell.mn-g1");
    expect(MN_CSS).toContain(".mn-cell.mn-t0");
    const reducedBlock = MN_CSS.slice(MN_CSS.indexOf("prefers-reduced-motion"));
    expect(reducedBlock).toContain(".mn-cell.mn-turn{animation:none;}");
    expect(reducedBlock).toContain(".mn-cell.mn-flag svg{animation:none;}");
    expect(reducedBlock).toContain(".mn-cell .mn-pop{animation:none;");
  });
});
