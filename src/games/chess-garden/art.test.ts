/**
 * 花园国际象棋 · 1.3 视觉契约（窗口 2 · 第 7 步 B）。
 *
 * 只增不减地看住四件事：
 *  1. 素材本身：pieceSVG 6 类 × 2 色 12 张互不相同、图元 ≤ 18、色板全是合法 #rrggbb；
 *  2. 上盘效果：棋子节点是 SVG 不再是 Unicode 字符文本，中文角标保留，坐标 / 小绿芽 /
 *     四角红三角 / 将军气泡 / 花盆 / 座位头像 / 记谱色点都真的挂在 DOM 上；
 *  3. 演出：animate() 滑行还在（transform 断言）、吃子出三片花瓣、升变走 0.4s 开花且
 *     收尾干净；`prefers-reduced-motion` 下三样特效一个都不生成；
 *  4. 读屏回归：`squareLabel` 的每一句逐字不变（快照断言）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ART_PALETTE,
  TONE_BLACK,
  TONE_WHITE,
  captureMarkSVG,
  overSceneSVG,
  petalSVG,
  pieceSVG,
  potSVG,
  sproutSVG,
} from "./art";
import { PIECE_CN, parseSquare, type PieceType } from "./board";
import { flushFrames, flushTimers, installDom, restoreDom, type Dom, type El } from "./domStub";
import { mount } from "./index";
import { findMove, fromSan } from "./moves";
import { SLIDE_MS, boardOrder, createBoard } from "./view";

let dom: Dom;

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

const TYPES: PieceType[] = [1, 2, 3, 4, 5, 6];

/** 双人真人棋盘（测试直接点格子 / 调 playHuman） */
function soloBoard(fen?: string, extra: Record<string, unknown> = {}) {
  const sfx: string[] = [];
  const handle = createBoard(dom.root as unknown as HTMLElement, {
    fen,
    seats: [
      { name: "朵朵", emoji: "🌸", color: "#fff", ai: null },
      { name: "星星", emoji: "⭐", color: "#eef", ai: null },
    ],
    banner: "视觉契约",
    tip: "测试提示",
    aiDelayMs: 0,
    sfx: (n: string) => sfx.push(n),
    ...extra,
  } as never);
  return { handle, sfx };
}

function squareAt(name: string): El {
  return dom.root.byClass("cg-sq")[boardOrder(false).indexOf(parseSquare(name))];
}

/** 把 matchMedia 换成「减少动效」的答复（restoreDom 会还原） */
function forceReducedMotion(): void {
  (globalThis as Record<string, unknown>).matchMedia = (q: string) => ({ matches: true, media: q });
}

/* ------------------------------------------------------------------ */
/* 素材契约：pieceSVG 12 张                                              */
/* ------------------------------------------------------------------ */

describe("art · 花园居民棋子素材", () => {
  it("6 类 × 2 色共 12 张全都非空、含 <svg>，而且互不相同", () => {
    const all: string[] = [];
    for (const t of TYPES) {
      for (const white of [true, false]) {
        const svg = pieceSVG(t, white);
        expect(svg.length).toBeGreaterThan(80);
        expect(svg).toContain("<svg");
        expect(svg).toContain('viewBox="0 0 32 36"');
        all.push(svg);
      }
    }
    expect(new Set(all).size).toBe(12);
  });

  it("每张棋子的绘制图元 ≤ 18 个，保证 64 格内联不吃性能", () => {
    for (const t of TYPES) {
      for (const white of [true, false]) {
        const svg = pieceSVG(t, white);
        const n = (svg.match(/<(path|circle|ellipse|rect|line|polygon|polyline)\b/g) ?? []).length;
        expect(n, `兵种 ${t}（${white ? "白" : "黑"}）画了 ${n} 个图元`).toBeLessThanOrEqual(18);
        expect(n).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("每张都带底座与投影（立体感三层），装饰 SVG 对读屏隐藏", () => {
    for (const t of TYPES) {
      const svg = pieceSVG(t, true);
      expect(svg).toContain('aria-hidden="true"');
      // plinth：投影 + 椭圆底座至少两枚 ellipse
      expect((svg.match(/<ellipse/g) ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("色板全是合法 #rrggbb，白黑两方主色不同（双通道可分辨）", () => {
    for (const [name, hex] of Object.entries(ART_PALETTE)) {
      expect(hex, `${name} 不是合法色值：${hex}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(TONE_WHITE.body).not.toBe(TONE_BLACK.body);
    expect(TONE_WHITE.line).not.toBe(TONE_BLACK.line);
  });

  it("花瓣三个深浅互不相同；绿芽 / 四角红三角 / 花盆也都是独立素材", () => {
    const petals = [petalSVG(0), petalSVG(1), petalSVG(2)];
    expect(new Set(petals).size).toBe(3);
    for (const svg of [...petals, sproutSVG(), captureMarkSVG(), potSVG()]) {
      expect(svg).toContain("<svg");
    }
    expect(sproutSVG()).not.toBe(captureMarkSVG());
    // 可吃标记是四角三角形（形状通道），不是圆点
    expect(captureMarkSVG()).toContain('preserveAspectRatio="none"');
  });

  it("结算插画三种场面互不相同：赢家有花环、和棋有白鸽", () => {
    const scenes = [overSceneSVG("white"), overSceneSVG("black"), overSceneSVG("draw")];
    expect(new Set(scenes).size).toBe(3);
    expect(overSceneSVG("white")).toContain("cg-art-wreath");
    expect(overSceneSVG("black")).toContain("cg-art-wreath");
    expect(overSceneSVG("draw")).toContain("cg-art-dove");
  });

  it("view.ts 里不再有任何 Unicode 棋子字符", () => {
    const src = readFileSync(fileURLToPath(new URL("./view.ts", import.meta.url)), "utf8");
    for (const ch of ["♙", "♘", "♗", "♖", "♕", "♔", "♟", "♞", "♝", "♜", "♛", "♚"]) {
      expect(src.includes(ch), `view.ts 里还留着「${ch}」`).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 上盘：棋子节点、坐标、状态标记                                        */
/* ------------------------------------------------------------------ */

describe("view · 棋子与棋盘装饰上盘", () => {
  it("cg-piece-mark 里是 SVG 不是字符文本，中文角标 cg-piece-tag 保留", () => {
    const { handle } = soloBoard();
    const e1 = squareAt("e1");
    const mark = e1.querySelector(".cg-piece-mark")!;
    expect(mark.textContent).toBe("");
    expect(mark.innerHTML).toContain("<svg");
    expect(mark.innerHTML).toBe(pieceSVG(6, true));
    expect(e1.querySelector(".cg-piece-tag")!.textContent).toBe(PIECE_CN[6]);
    // 黑王也一样
    const e8mark = squareAt("e8").querySelector(".cg-piece-mark")!;
    expect(e8mark.innerHTML).toBe(pieceSVG(6, false));
    handle.destroy();
  });

  it("64 格棋子张张对号：兵马象车后王 × 白黑取的都是对应的那张图", () => {
    const { handle } = soloBoard();
    const checks: Array<[string, PieceType, boolean]> = [
      ["a2", 1, true],
      ["b1", 2, true],
      ["c1", 3, true],
      ["a1", 4, true],
      ["d1", 5, true],
      ["e1", 6, true],
      ["a7", 1, false],
      ["g8", 2, false],
      ["f8", 3, false],
      ["h8", 4, false],
      ["d8", 5, false],
      ["e8", 6, false],
    ];
    for (const [name, type, white] of checks) {
      expect(squareAt(name).querySelector(".cg-piece-mark")!.innerHTML, `${name} 的棋子图不对`).toBe(
        pieceSVG(type, white)
      );
    }
    handle.destroy();
  });

  it("坐标标注：底排 a–h、左列 1–8 共 16 枚小字，a1 那格两样都有", () => {
    const { handle } = soloBoard();
    const coords = dom.root.byClass("cg-coord");
    expect(coords).toHaveLength(16);
    for (const c of coords) expect(c.getAttribute("aria-hidden")).toBe("true");
    const a1 = squareAt("a1");
    expect(a1.byClass("cg-coord").map((c) => c.textContent)).toEqual(["a", "1"]);
    expect(squareAt("d1").byClass("cg-coord").map((c) => c.textContent)).toEqual(["d"]);
    expect(squareAt("a5").byClass("cg-coord").map((c) => c.textContent)).toEqual(["5"]);
    handle.destroy();
  });

  it("翻转棋盘后坐标跟着格子走：显示在左下角的变成 h8", () => {
    const { handle } = soloBoard(undefined, { flipped: true });
    const cells = dom.root.byClass("cg-sq");
    const flipped = boardOrder(true);
    const h8 = cells[flipped.indexOf(parseSquare("h8"))];
    expect(h8.byClass("cg-coord").map((c) => c.textContent)).toEqual(["h", "8"]);
    expect(dom.root.byClass("cg-coord")).toHaveLength(16);
    handle.destroy();
  });

  it("篱笆四角挂着 4 只小花盆，全部对读屏隐藏、不占 cg-sq", () => {
    const { handle } = soloBoard();
    const pots = dom.root.byClass("cg-pot");
    expect(pots).toHaveLength(4);
    for (const pot of pots) {
      expect(pot.getAttribute("aria-hidden")).toBe("true");
      expect(pot.innerHTML).toContain("<svg");
    }
    expect(dom.root.byClass("cg-sq")).toHaveLength(64);
    handle.destroy();
  });

  it("选中后可走点长小绿芽、可吃格盖四角红三角，class 语义照旧", () => {
    const { handle } = soloBoard("6k1/8/8/8/8/7K/8/R3r3 w - - 0 1");
    squareAt("a1").click();
    expect(dom.root.byClass("cg-sprout").length).toBeGreaterThanOrEqual(3);
    expect(dom.root.byClass("cg-capmark")).toHaveLength(1);
    const e1 = squareAt("e1");
    expect(e1.className).toContain("cg-sq--cap");
    expect(e1.querySelector(".cg-capmark")!.innerHTML).toContain("<svg");
    expect(squareAt("b1").className).toContain("cg-sq--hint");
    expect(squareAt("b1").querySelector(".cg-sprout")!.innerHTML).toContain("<svg");
    handle.destroy();
  });

  it("被将军的王头顶冒「!」气泡，整盘只此一枚", () => {
    const { handle } = soloBoard("6k1/8/8/8/8/8/8/4r2K w - - 0 1");
    const alerts = dom.root.byClass("cg-alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe("!");
    expect(squareAt("h1").querySelector(".cg-alert")).not.toBeNull();
    handle.destroy();
  });

  it("座位 chip 带王头像，白黑两枚不一样；记谱行有色点和最后一手高亮", () => {
    const { handle } = soloBoard();
    const avas = dom.root.byClass("cg-seat-ava");
    expect(avas).toHaveLength(2);
    expect(avas[0].innerHTML).toContain("<svg");
    expect(avas[0].innerHTML).not.toBe(avas[1].innerHTML);
    handle.playHuman(fromSan(handle.game.pos, "e4")!);
    handle.playHuman(fromSan(handle.game.pos, "e5")!);
    handle.playHuman(fromSan(handle.game.pos, "Nf3")!);
    const rows = dom.root.byClass("cg-log-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].byClass("cg-log-dot")).toHaveLength(2);
    expect(rows[1].byClass("cg-log-dot")).toHaveLength(1);
    expect(rows[0].className).not.toContain("cg-log-row--last");
    expect(rows[1].className).toContain("cg-log-row--last");
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* 读屏回归：squareLabel 逐字不变                                        */
/* ------------------------------------------------------------------ */

describe("view · squareLabel 读屏文案逐字回归", () => {
  function labelOf(name: string): string {
    return squareAt(name).getAttribute("aria-label") ?? "";
  }

  it("格名 / 棋子 / 光标 / 空格：一字不差", () => {
    const { handle } = soloBoard();
    expect(labelOf("e1")).toBe("e1 白王，光标在这儿");
    expect(labelOf("d4")).toBe("d4 空格");
    expect(labelOf("e8")).toBe("e8 黑王");
    expect(labelOf("g8")).toBe("g8 黑马");
    handle.destroy();
  });

  it("已选中 / 可以走到这儿 / 可以吃这一颗 / 正被将军：一字不差", () => {
    const { handle } = soloBoard();
    squareAt("e2").click();
    expect(labelOf("e2")).toBe("e2 白兵，已选中，光标在这儿");
    expect(labelOf("e3")).toBe("e3 空格，可以走到这儿");
    expect(labelOf("e4")).toBe("e4 空格，可以走到这儿");
    handle.destroy();
    const { handle: h2 } = soloBoard("6k1/8/8/8/8/7K/8/R3r3 w - - 0 1");
    squareAt("a1").click();
    expect(labelOf("e1")).toBe("e1 黑车，可以吃这一颗");
    h2.destroy();
    const { handle: h3 } = soloBoard("6k1/8/8/8/8/8/8/4r2K w - - 0 1");
    expect(labelOf("h1")).toContain("正被将军");
    h3.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* 演出：滑行 / 吃子花瓣 / 升变开花 与 reduced 降级                       */
/* ------------------------------------------------------------------ */

describe("view · 走子滑行与吃子 / 升变演出", () => {
  it("animate() 滑行保留：先摆回起点的位移，再在下一帧滑回 0", () => {
    const { handle } = soloBoard();
    squareAt("e2").rect = { left: 40, top: 240, width: 40, height: 40 };
    squareAt("e4").rect = { left: 40, top: 160, width: 40, height: 40 };
    handle.playHuman(findMove(handle.game.pos, parseSquare("e2"), parseSquare("e4"))!);
    const chip = squareAt("e4").children[0];
    expect(chip.className).toContain("cg-piece");
    expect(chip.style.transform).toBe("translate(0px, 80px)");
    expect(chip.style.transition).toBe("none");
    flushFrames(dom, 2);
    expect(chip.style.transform).toBe("translate(0px, 0px)");
    expect(chip.style.transition).toContain(`${SLIDE_MS}ms`);
    handle.destroy();
  });

  it("吃子：目标格上出一层 cg-capture-fx（残影 + 三片花瓣），收尾自动拆掉", () => {
    const { handle } = soloBoard("6k1/8/8/3p4/4P3/8/8/6K1 w - - 0 1");
    squareAt("e4").click();
    squareAt("d5").click();
    expect(handle.game.history.map((h) => h.san)).toEqual(["exd5"]);
    const fx = dom.root.byClass("cg-capture-fx");
    expect(fx).toHaveLength(1);
    expect(fx[0].getAttribute("aria-hidden")).toBe("true");
    expect(dom.root.byClass("cg-petal")).toHaveLength(3);
    expect(dom.root.byClass("cg-capture-ghost")[0].innerHTML).toBe(pieceSVG(1, false));
    expect(dom.timers.size).toBe(1);
    flushTimers(dom, 2);
    expect(dom.root.byClass("cg-capture-fx")).toHaveLength(0);
    expect(dom.root.byClass("cg-petal")).toHaveLength(0);
    handle.destroy();
  });

  it("reduced：吃子不出花瓣层、不排收尾定时器，直接消失", () => {
    forceReducedMotion();
    const { handle } = soloBoard("6k1/8/8/3p4/4P3/8/8/6K1 w - - 0 1");
    squareAt("e4").click();
    squareAt("d5").click();
    expect(handle.game.history.map((h) => h.san)).toEqual(["exd5"]);
    expect(dom.root.byClass("cg-capture-fx")).toHaveLength(0);
    expect(dom.root.byClass("cg-petal")).toHaveLength(0);
    expect(dom.timers.size).toBe(0);
    handle.destroy();
  });

  it("升变开花：0.4s 内挂着 cg-bloom 与 cg-piece--bloom，结束后棋子类型正确、节点清理干净", () => {
    const { handle } = soloBoard("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
    squareAt("b7").click();
    squareAt("b8").click();
    dom.root.byClass("cg-promo-b")[0].click();
    expect(handle.game.history[0].san).toBe("b8=Q+");
    const chip = squareAt("b8").children[0];
    expect(chip.className).toContain("cg-piece--bloom");
    expect(dom.root.byClass("cg-bloom")).toHaveLength(1);
    expect(dom.root.byClass("cg-bloom")[0].byClass("cg-petal")).toHaveLength(5);
    expect(squareAt("b8").querySelector(".cg-piece-mark")!.innerHTML).toBe(pieceSVG(5, true));
    flushTimers(dom, 2);
    expect(dom.root.byClass("cg-bloom")).toHaveLength(0);
    expect(squareAt("b8").children[0].className).not.toContain("cg-piece--bloom");
    expect(squareAt("b8").querySelector(".cg-piece-mark")!.innerHTML).toBe(pieceSVG(5, true));
    handle.destroy();
  });

  it("reduced：升变直接换成新子，没有开花层也没有动画类", () => {
    forceReducedMotion();
    const { handle } = soloBoard("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
    squareAt("b7").click();
    squareAt("b8").click();
    dom.root.byClass("cg-promo-b")[0].click();
    expect(handle.game.history[0].san).toBe("b8=Q+");
    expect(dom.root.byClass("cg-bloom")).toHaveLength(0);
    expect(squareAt("b8").children[0].className).not.toContain("cg-piece--bloom");
    expect(squareAt("b8").querySelector(".cg-piece-mark")!.innerHTML).toBe(pieceSVG(5, true));
    expect(dom.timers.size).toBe(0);
    handle.destroy();
  });

  it("升变四选一按钮带棋子小图，文字与 aria-label 照旧", () => {
    const { handle } = soloBoard("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
    squareAt("b7").click();
    squareAt("b8").click();
    const icons = dom.root.byClass("cg-promo-icon");
    expect(icons).toHaveLength(4);
    for (const icon of icons) expect(icon.innerHTML).toContain("<svg");
    const picks = dom.root.byClass("cg-promo-b");
    expect(picks.map((p) => p.textContent)).toEqual(["后", "车", "象", "马"]);
    expect(picks[0].getAttribute("aria-label")).toBe("升变成后");
    handle.destroy();
  });

  it("destroy 会把还没收尾的特效定时器一并清掉", () => {
    const { handle } = soloBoard("6k1/8/8/3p4/4P3/8/8/6K1 w - - 0 1");
    squareAt("e4").click();
    squareAt("d5").click();
    expect(dom.timers.size).toBe(1);
    handle.destroy();
    expect(flushTimers(dom, 4)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 结算插画：双人同屏走出将杀，浮层里有花环场面                            */
/* ------------------------------------------------------------------ */

describe("index · 结算浮层插画", () => {
  it("双人同屏黑方将杀后，结算浮层带 cg-over-art（花环 + 王）", () => {
    const played: string[] = [];
    const handle = mount({
      root: dom.root as unknown as HTMLElement,
      play: (n: string) => played.push(n),
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => undefined,
      onLose: () => undefined,
    } as never);
    dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes("双人同屏")).pop()!.click();
    const click = (name: string): void => {
      dom.root.byClass("cg-sq")[boardOrder(false).indexOf(parseSquare(name))].click();
    };
    // 最快将杀：1. f3 e5 2. g4 Qh4#
    click("f2");
    click("f3");
    click("e7");
    click("e5");
    click("g2");
    click("g4");
    click("d8");
    click("h4");
    const art = dom.root.byClass("cg-over-art");
    expect(art).toHaveLength(1);
    expect(art[0].getAttribute("aria-hidden")).toBe("true");
    expect(art[0].innerHTML).toContain("cg-art-wreath");
    expect(art[0].innerHTML).toBe(overSceneSVG("black"));
    expect(dom.root.find((e) => e.className.includes("cg-over-t"))!.textContent).toContain("黑方赢了这一局");
    handle.destroy();
  });
});
