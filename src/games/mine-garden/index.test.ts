import { afterEach, describe, expect, it } from "vitest";
import { GAME_MODES } from "../../engine/types";
import { OPEN, indexOf } from "./board";
import { AI_TIER_HINTS, AI_TIER_LABELS, AI_TIERS } from "./ai";
import guide from "./guide";
import { allLevels, levelAt, loseLine, winLine } from "./levels";
import { installDom, type DomStub, type FakeEl } from "./testkit";
import {
  AI_TICK_MS,
  LONG_PRESS_CHOICES,
  LONG_PRESS_MS,
  MAX_CELL,
  MG_CONSTS,
  MN_CSS,
  MIN_CELL,
  MODE_LABELS,
  PRESETS,
  bloomStepMs,
  cellPx,
  clockText,
  endlessLine,
  endlessMines,
  flipMs,
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
    expect(meta.platform).toBe("both");
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
