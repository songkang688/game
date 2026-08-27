// 1.3 HUD 升级契约：座位条（棋子图标 + 名字 + 计时 + 轮到方金色描边）、
// AI 思考沙漏、胜利结算仪式卡。只断言展示层 —— 胜负判定、AI、题库一个都不碰。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIFFICULTY_NAME, THINK_DELAY_MS } from "./ai";
import { installDom, restoreDom, type Dom, type El } from "./domStub";
import { VIEW_W, WIN_JUMP_GAP_MS, WIN_JUMP_MS, WIN_SWEEP_MS } from "./view";

let dom: Dom;

beforeEach(() => {
  dom = installDom(800);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});

afterEach(() => {
  vi.useRealTimers();
  restoreDom();
});

function fakeApi(root: El): {
  root: HTMLElement;
  play: (n: string) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, msg?: string) => void;
  onLose: (msg?: string) => void;
} {
  let stars = 0;
  return {
    root: root as unknown as HTMLElement,
    play: () => undefined,
    addStars: (n: number) => (stars += n),
    getStars: () => stars,
    onWin: () => undefined,
    onLose: () => undefined,
  };
}

function tapBoard(canvas: El, size: number, x: number, y: number): void {
  const cs = VIEW_W / (size + 1);
  const ev = { clientX: cs + x * cs, clientY: cs + y * cs, preventDefault: () => undefined };
  canvas.dispatch("pointerdown", ev);
  canvas.dispatch("pointerup", ev);
}

function findByText(root: El, text: string): El | null {
  return root.find((e) => e.tagName === "button" && e.textContent.includes(text));
}

/** 打开自由对战并落座：opponent 是选项按钮上的文字（朵朵 VS 星星 / 某一档 AI 名） */
async function openTable(opponent: string): Promise<{ handle: { destroy: () => void }; canvas: El }> {
  const { mount } = await import("./index");
  const handle = mount(fakeApi(dom.root));
  findByText(dom.root, "自由对战")!.dispatch("click", {});
  findByText(dom.root, opponent)!.dispatch("click", {});
  findByText(dom.root, "开始下棋")!.dispatch("click", {});
  const canvas = dom.root.find((e) => e.tagName === "canvas")!;
  return { handle, canvas };
}

describe("1.3 HUD · 纯函数", () => {
  it("fmtClock 是 m:ss，负数与小数都夹稳", async () => {
    const { fmtClock } = await import("./index");
    expect(fmtClock(0)).toBe("0:00");
    expect(fmtClock(5)).toBe("0:05");
    expect(fmtClock(65)).toBe("1:05");
    expect(fmtClock(600)).toBe("10:00");
    expect(fmtClock(-3)).toBe("0:00");
    expect(fmtClock(61.9)).toBe("1:01");
  });

  it("seatNames 黑先白后：双人是朵朵/星星，人机报档位名，谜题是你/守方", async () => {
    const { seatNames } = await import("./index");
    expect(seatNames({ human: "both", ai: null })).toEqual(["朵朵 · 黑棋", "星星 · 白棋"]);
    expect(seatNames({ human: 1, ai: "novice" })).toEqual(["你 · 黑棋", DIFFICULTY_NAME.novice]);
    expect(seatNames({ human: 1, ai: null, puzzle: {} as never })).toEqual(["你 · 黑棋", "守方 · 白棋"]);
  });

  it("结算卡等扫光 + 五颗跳完再亮相（时序由常数锁死）", async () => {
    const { CEREMONY_DELAY_MS } = await import("./index");
    expect(CEREMONY_DELAY_MS).toBe(WIN_SWEEP_MS + WIN_JUMP_GAP_MS * 4 + WIN_JUMP_MS + 80);
  });
});

describe("1.3 HUD · 座位条", () => {
  it("黑白两个座位都有矢量棋子图标和名字，开局黑方金色描边", async () => {
    const { handle, canvas } = await openTable("朵朵 VS 星星");
    const seats = dom.root.querySelectorAll(".gmk-seat");
    expect(seats.length).toBe(2);
    expect(seats[0].allText()).toContain("朵朵");
    expect(seats[1].allText()).toContain("星星");
    for (const s of seats) {
      expect(s.querySelector(".gmk-seat-ico")!.innerHTML).toContain("<svg");
    }
    expect(seats[0].className).toContain("gmk-seat-on");
    expect(seats[1].className).not.toContain("gmk-seat-on");
    // 黑棋落一手，金色描边移到白方
    tapBoard(canvas, 15, 7, 7);
    expect(seats[0].className).not.toContain("gmk-seat-on");
    expect(seats[1].className).toContain("gmk-seat-on");
    handle.destroy();
  });

  it("计时只给轮到的一方走表", async () => {
    const { handle, canvas } = await openTable("朵朵 VS 星星");
    const times = dom.root.querySelectorAll(".gmk-seat-time");
    expect(times[0].textContent).toBe("0:00");
    vi.advanceTimersByTime(3000);
    expect(times[0].textContent).toBe("0:03");
    expect(times[1].textContent).toBe("0:00");
    tapBoard(canvas, 15, 7, 7);
    vi.advanceTimersByTime(2000);
    expect(times[0].textContent).toBe("0:03");
    expect(times[1].textContent).toBe("0:02");
    handle.destroy();
  });
});

describe("1.3 HUD · 思考沙漏", () => {
  it("AI 思考时棋盘右上角亮沙漏，想完就收", async () => {
    const { handle, canvas } = await openTable(DIFFICULTY_NAME.novice);
    const sand = dom.root.querySelector(".gmk-sand")!;
    expect(sand.innerHTML).toContain("<svg");
    expect(sand.hidden).toBe(true);
    tapBoard(canvas, 15, 7, 7);
    expect(sand.hidden).toBe(false);
    vi.advanceTimersByTime(THINK_DELAY_MS.novice + 50);
    expect(sand.hidden).toBe(true);
    handle.destroy();
  });
});

describe("1.3 HUD · 胜利结算仪式", () => {
  it("连成五颗后：先播扫光跳子，再弹结算卡（胜方棋子大图 + 手数 + 复盘）", async () => {
    const { CEREMONY_DELAY_MS } = await import("./index");
    const { handle, canvas } = await openTable("朵朵 VS 星星");
    const black: Array<[number, number]> = [
      [3, 3],
      [4, 3],
      [5, 3],
      [6, 3],
      [7, 3],
    ];
    const white: Array<[number, number]> = [
      [3, 10],
      [4, 10],
      [5, 10],
      [6, 10],
    ];
    for (let i = 0; i < 4; i++) {
      tapBoard(canvas, 15, black[i][0], black[i][1]);
      tapBoard(canvas, 15, white[i][0], white[i][1]);
    }
    tapBoard(canvas, 15, black[4][0], black[4][1]);
    // 仪式先让扫光和跳子播完，卡不能抢戏
    expect(dom.root.querySelector(".gmk-ceremony")).toBeNull();
    vi.advanceTimersByTime(CEREMONY_DELAY_MS + 40);
    const card = dom.root.querySelector(".gmk-ceremony");
    expect(card).not.toBeNull();
    expect(card!.allText()).toContain("朵朵");
    expect(card!.allText()).toContain("连成五颗");
    expect(card!.allText()).toContain("共 9 手");
    expect(card!.querySelector(".gmk-over-stoneimg")!.innerHTML).toContain("<svg");
    // 复盘按钮收起卡片，让孩子看终局盘面
    findByText(dom.root, "复盘")!.dispatch("click", {});
    expect(dom.root.querySelector(".gmk-ceremony")).toBeNull();
    handle.destroy();
  });

  it("平局 / 禁手判负不弹五连仪式卡", async () => {
    const { CEREMONY_DELAY_MS } = await import("./index");
    const { handle, canvas } = await openTable("朵朵 VS 星星");
    tapBoard(canvas, 15, 7, 7);
    vi.advanceTimersByTime(CEREMONY_DELAY_MS * 2);
    expect(dom.root.querySelector(".gmk-ceremony")).toBeNull();
    handle.destroy();
  });
});
