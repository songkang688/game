// 推箱小仓鼠 · 1.3 视觉升级运行期冒烟(桩 DOM,和 alien-seek/visualSmoke 一个路数):
// 真跑 createBoard → 推 / 滑 / 传三种移动 → 过关庆祝 → destroy,
// 断言三种移动走的是三条视觉分支、bh-done 跟随状态、关卡数据一个字不改、
// 28px 兜底只省尘土不省姿态、destroy 后特效计时器归零。
// 只断言视觉与「状态没被改」,不断言任何玩法数值。
import { afterEach, describe, expect, it } from "vitest";
import type { LevelDef } from "./levels";
import { parsePuzzle } from "./logic";

type Fn = (...args: unknown[]) => unknown;

class El {
  tag: string;
  children: El[] = [];
  listeners = new Map<string, Fn[]>();
  attrs = new Map<string, string>();
  style: Record<string, unknown>;
  className = "";
  hidden = false;
  disabled = false;
  type = "";
  clientWidthValue = 360;
  parentEl: El | null = null;
  private html = "";
  private text = "";
  constructor(tag: string) {
    this.tag = tag;
    const bag: Record<string, unknown> = {};
    bag.setProperty = (k: string, v: string): void => {
      bag[k] = v;
    };
    bag.removeProperty = (k: string): void => {
      delete bag[k];
    };
    this.style = bag;
  }
  set innerHTML(v: string) {
    this.html = v;
    if (v === "") this.children = [];
  }
  get innerHTML(): string {
    return this.html;
  }
  set textContent(v: string) {
    this.text = v;
    // 和真 DOM 一致:写 textContent 会清空子节点
    this.children = [];
  }
  get textContent(): string {
    return this.text;
  }
  appendChild(c: El): El {
    this.children.push(c);
    c.parentEl = this;
    return c;
  }
  append(...cs: Array<El | string>): void {
    for (const c of cs) if (c instanceof El) this.appendChild(c);
  }
  replaceChildren(...cs: El[]): void {
    this.children = [];
    for (const c of cs) this.appendChild(c);
  }
  removeChild(c: El): El {
    this.children = this.children.filter((x) => x !== c);
    return c;
  }
  remove(): void {
    this.parentEl?.removeChild(this);
  }
  addEventListener(t: string, f: Fn): void {
    const arr = this.listeners.get(t) ?? [];
    arr.push(f);
    this.listeners.set(t, arr);
  }
  removeEventListener(): void {}
  dispatch(t: string, ev: Record<string, unknown> = {}): void {
    for (const f of this.listeners.get(t) ?? []) f({ preventDefault: () => {}, stopPropagation: () => {}, ...ev });
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  get clientWidth(): number {
    return this.clientWidthValue;
  }
  get classList(): { add: (...cs: string[]) => void; remove: (...cs: string[]) => void; contains: (c: string) => boolean } {
    return {
      add: (...cs: string[]) => {
        const cur = this.className.split(/\s+/).filter(Boolean);
        for (const c of cs) if (!cur.includes(c)) cur.push(c);
        this.className = cur.join(" ");
      },
      remove: (...cs: string[]) => {
        this.className = this.className
          .split(/\s+/)
          .filter((c) => c && !cs.includes(c))
          .join(" ");
      },
      contains: (c: string) => this.className.split(/\s+/).includes(c),
    };
  }
  get isConnected(): boolean {
    return true;
  }
  focus(): void {}
  /** 收集整棵子树,找元素用 */
  all(): El[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
}

interface StubWin {
  dispatch: (t: string, ev?: Record<string, unknown>) => void;
}

function installDom(reduced = false): StubWin {
  const g = globalThis as Record<string, unknown>;
  g.document = {
    createElement: (tag: string) => new El(tag),
    body: new El("body"),
    documentElement: new El("html"),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const winListeners = new Map<string, Fn[]>();
  const win: StubWin & Record<string, unknown> = {
    addEventListener: (t: string, f: Fn) => {
      const arr = winListeners.get(t) ?? [];
      arr.push(f);
      winListeners.set(t, arr);
    },
    removeEventListener: () => {},
    dispatch: (t: string, ev: Record<string, unknown> = {}) => {
      for (const f of [...(winListeners.get(t) ?? [])]) f({ preventDefault: () => {}, ...ev });
    },
    setTimeout,
    clearTimeout,
    innerWidth: 360,
    innerHeight: 640,
  };
  g.window = win;
  g.requestAnimationFrame = (): number => 1;
  g.cancelAnimationFrame = () => {};
  if (reduced) g.matchMedia = () => ({ matches: true });
  return win;
}

function uninstallDom(): void {
  const g = globalThis as Record<string, unknown>;
  delete g.document;
  delete g.window;
  delete g.requestAnimationFrame;
  delete g.cancelAnimationFrame;
  delete g.matchMedia;
}

afterEach(() => uninstallDom());

/** 用字符画拼一关(只造视觉冒烟用的最小 LevelDef,不碰真关卡数据) */
function defOf(rows: string[]): LevelDef {
  return {
    ...parsePuzzle(rows),
    kind: "campaign",
    index: 0,
    chapterIndex: 0,
    name: "冒烟测试仓",
    feature: "",
    hint: "推推看",
    parMoves: 99,
    twoStarMoves: 99,
    bestMoves: 1,
    bestPushes: 1,
    reference: [],
  };
}

interface Mounted {
  board: {
    destroy: () => void;
    pendingFx: () => number;
  };
  root: El;
  grid: El;
  cells: El[];
  win: StubWin;
  won: () => boolean;
}

async function mountBoard(rows: string[], reduced = false): Promise<Mounted> {
  const win = installDom(reduced);
  const { createBoard } = await import("./index");
  const root = new El("div");
  let won = false;
  const board = createBoard(root as unknown as HTMLElement, {
    def: defOf(rows),
    sfx: () => {},
    onWin: () => {
      won = true;
    },
  });
  const grid = root.all().find((e) => e.className.includes("bh-grid"))!;
  expect(grid).toBeTruthy();
  return { board, root, grid, cells: grid.children, win, won: () => won };
}

const pieceOf = (cell: El, cls: string): El | undefined => cell.children.find((c) => c.className.includes(cls));
const fxOf = (cell: El, inner: string): El | undefined =>
  cell.children.find((c) => c.className.includes("bxh-fxwrap") && c.innerHTML.includes(inner));

describe("冒烟 · 推箱:SVG 棋子 / 尘土 / 礼物盒 / 庆祝 / destroy 归零", () => {
  it("挂载即是 SVG:仓鼠与木箱都不再是裸 emoji", async () => {
    const m = await mountBoard(["#####", "#@$.#", "#####"]);
    const hamster = pieceOf(m.cells[6], "bxh-hamster")!;
    const box = pieceOf(m.cells[7], "bxh-box")!;
    expect(hamster.innerHTML).toContain("<svg");
    expect(hamster.innerHTML).toContain('data-facing="2"');
    expect(hamster.innerHTML).toContain('data-pose="idle"');
    expect(box.innerHTML).toContain("bxh-box-planks");
    for (const c of m.cells) {
      expect(c.textContent).not.toContain("📦");
      for (const child of c.all()) expect(child.innerHTML).not.toContain("📦");
    }
    m.board.destroy();
  });

  it("推箱到位:推箱姿态 + 箱底尘土 + 礼物盒脉冲 + bh-done + 全场彩带,destroy 后计时器归零", async () => {
    const m = await mountBoard(["#####", "#@$.#", "#####"]);
    const def = defOf(["#####", "#@$.#", "#####"]);
    const terrainBefore = JSON.stringify([def.wall, def.ice, def.target, def.portal]);
    m.win.dispatch("keydown", { code: "ArrowRight" });
    expect(m.won()).toBe(true);
    // 推的那只仓鼠摆推箱姿态,箱底(它脚下这格)冒尘土
    const hamster = pieceOf(m.cells[7], "bxh-hamster")!;
    expect(hamster.innerHTML).toContain('data-pose="push"');
    expect(fxOf(m.cells[7], "bxh-dust")).toBeTruthy();
    // 到位的箱子变礼物盒,bh-done 语义不变,金光脉冲只在刚归位这一下
    expect(m.cells[8].className).toContain("bh-done");
    const gift = pieceOf(m.cells[8], "bxh-box")!;
    expect(gift.innerHTML).toContain("bxh-gift-pulse");
    // 过关:棋盘挂 bxh-win,礼物盒那格放彩带
    expect(m.grid.className).toContain("bxh-win");
    expect(fxOf(m.cells[8], "bxh-confetti")).toBeTruthy();
    // 关卡数据一个字没改(读状态不改状态)
    expect(JSON.stringify([def.wall, def.ice, def.target, def.portal])).toBe(terrainBefore);
    // destroy 把尘土 / 彩带的清场计时器全收走
    expect(m.board.pendingFx()).toBeGreaterThan(0);
    m.board.destroy();
    expect(m.board.pendingFx()).toBe(0);
  });

  it("平移插值沿用既有机制:走一步的棋子带 bxh-slide 与 --bxh-dur", async () => {
    const m = await mountBoard(["#####", "#@  #", "#$ .#", "#####"]);
    m.win.dispatch("keydown", { code: "ArrowRight" });
    const hamster = pieceOf(m.cells[7], "bxh-hamster")!;
    expect(hamster.className).toContain("bxh-slide");
    expect(hamster.style["--bxh-dur"]).toBe("120ms");
    m.board.destroy();
  });
});

describe("冒烟 · 滑冰与传送:三种移动三条视觉分支", () => {
  it("冰面滑行:张爪哇嘴姿态 + 起点冰擦痕,不算推也不算传", async () => {
    const m = await mountBoard(["#######", "#@~~ .#", "# $   #", "#######"]);
    m.win.dispatch("keydown", { code: "ArrowRight" });
    // 一步滑了三格,落点在 (4,1)=11
    const hamster = pieceOf(m.cells[11], "bxh-hamster")!;
    expect(hamster.innerHTML).toContain('data-pose="slide"');
    expect(hamster.innerHTML).toContain("bhh-mouth-wow");
    expect(fxOf(m.cells[8], "bxh-scratch")).toBeTruthy();
    expect(fxOf(m.cells[8], "bxh-dust")).toBeFalsy();
    m.board.destroy();
  });

  it("传送:出口旋出 + 入口旋入,不做跨场长平移;进出口反色类各就各位", async () => {
    const m = await mountBoard(["######", "#@a  #", "#  A #", "# $ .#", "######"]);
    // 进口(下标小)不带反色类,出口带
    expect(m.cells[8].className).toContain("bh-portal");
    expect(m.cells[8].className).not.toContain("bxh-portal-out");
    expect(m.cells[15].className).toContain("bxh-portal-out");
    m.win.dispatch("keydown", { code: "ArrowRight" });
    const hamster = pieceOf(m.cells[15], "bxh-hamster")!;
    expect(hamster.className).toContain("bxh-tp-out");
    expect(hamster.className).not.toContain("bxh-slide");
    expect(fxOf(m.cells[8], "bxh-tp-in")).toBeTruthy();
    m.board.destroy();
  });
});

describe("冒烟 · 28px 兜底与 reduced 分支", () => {
  it("格子缩到 ≤28px:尘土省略,推箱姿态保留", async () => {
    const m = await mountBoard(["######", "#@$ .#", "######"]);
    // 把舞台掐窄再触发一次量宽:6 列只剩 150px → 每格 23px
    const stage = m.root.all().find((e) => e.className.includes("bh-stagebox"))!;
    stage.clientWidthValue = 150;
    m.win.dispatch("resize");
    m.win.dispatch("keydown", { code: "ArrowRight" });
    const hamster = pieceOf(m.cells[8], "bxh-hamster")!;
    expect(hamster.innerHTML).toContain('data-pose="push"');
    expect(fxOf(m.cells[8], "bxh-dust")).toBeFalsy();
    m.board.destroy();
  });

  it("reduced:传送不加旋出类(瞬移)、推箱不冒尘土,姿态与静态层次都在", async () => {
    const m = await mountBoard(["######", "#@a  #", "#  A #", "# $ .#", "######"], true);
    m.win.dispatch("keydown", { code: "ArrowRight" });
    const hamster = pieceOf(m.cells[15], "bxh-hamster")!;
    expect(hamster.className).not.toContain("bxh-tp-out");
    expect(fxOf(m.cells[8], "bxh-tp-in")).toBeFalsy();
    expect(hamster.innerHTML).toContain("<svg");
    m.board.destroy();

    const p = await mountBoard(["######", "#@$ .#", "######"], true);
    p.win.dispatch("keydown", { code: "ArrowRight" });
    const pusher = pieceOf(p.cells[8], "bxh-hamster")!;
    expect(pusher.innerHTML).toContain('data-pose="push"');
    expect(fxOf(p.cells[8], "bxh-dust")).toBeFalsy();
    expect(p.board.pendingFx()).toBe(0);
    p.board.destroy();
  });
});
