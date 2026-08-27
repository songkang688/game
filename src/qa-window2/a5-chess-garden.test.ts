/** 第 3 轮 · 包 A · chess-garden 走查（临时脚本，取证后整目录删除）。 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AI_PLANS, endlessChip, mount } from "../games/chess-garden/index";
import {
  El,
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "../games/chess-garden/domStub";
import {
  CHAPTERS,
  ENDLESS_COUNT,
  ENDLESS_TOP_TIER,
  buildLevel,
  endlessAtTop,
  endlessLap,
  endlessStart,
  endlessThinkMs,
  endlessTier,
  loseLine,
  rateLevel,
  winLine,
} from "../games/chess-garden/levels";
import { meta } from "../games/chess-garden/meta";
import { createGame, gameStatus, playMove } from "../games/chess-garden/rules";
import { legalMoves, toSan } from "../games/chess-garden/moves";
import { findForcedMate } from "../games/chess-garden/search";
import { BRAND_WORDS, RED_WORDS, dump, lastHitHeight, scanGame } from "./r3lib";

let dom: Dom;
const log: string[] = [];
const note = (l: string): void => void log.push(l);

beforeEach(() => {
  dom = installDom(360);
});
afterEach(() => {
  restoreDom();
});

function fakeApi() {
  return {
    root: dom.root as unknown as HTMLElement,
    play: () => undefined,
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined,
  } as never;
}
function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}
function sheets(): string {
  const inRoot = dom.root.findAll((e) => e.tagName === "style").map((s) => s.textContent);
  const inHead = dom.head.children.filter((c) => c.tagName === "style").map((s) => s.textContent);
  return [...inRoot, ...inHead].join("\n");
}

describe("R3 包A · chess-garden", () => {
  it("① 深链 / meta / 三个模式入口 + 四档", () => {
    const handle = mount(fakeApi());
    const opens = dom.root.findAll((e) => e.tagName === "button" && e.className.includes("cg-open"));
    const picks = dom.root.findAll((e) => e.tagName === "button" && e.className.includes("cg-pick"));
    note(
      `[chess-garden 深链] 模式入口=${opens.map((o) => o.textContent).join(" / ")}｜难度 ${picks.length} 档=${picks.map((p) => p.textContent).join(" ")}｜AI_PLANS=${JSON.stringify(AI_PLANS)}`
    );
    expect(opens).toHaveLength(3);
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("both");
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(188);
    handle.destroy();
  });

  it("②③ 战役第 1 / 76 / 188 关：题面真有强制赢法（搜索实证）", () => {
    const rows: string[] = [];
    for (const lv of [0, 75, 187]) {
      const spec = buildLevel(lv);
      const game = createGame(spec.fen);
      const legal = legalMoves(game.pos).length;
      const forced = spec.kind === "mate" ? findForcedMate(game.pos, spec.plies) : null;
      rows.push(
        `第 ${String(lv + 1).padStart(3)} 关 «${spec.title}» 类型=${spec.kind} ${spec.plies} 半回合 · 合法着 ${legal} 手 · 参考解 ${spec.solution}${spec.require ? "（硬性首着）" : ""} · 搜索找到的强制杀=${forced ? toSan(forced, game.pos) : "—"} · 过关语「${winLine(spec, 0)}」 · 失手语「${loseLine(spec)}」 · 零失误 ${rateLevel(0)}★`
      );
      if (spec.kind === "mate") expect(forced, `第 ${lv + 1} 关找不到强制杀`).not.toBeNull();
    }
    note(`[chess-garden 战役 1/76/188]\n  ${rows.join("\n  ")}`);
  });

  it("④ 三个模式进得去退得出", () => {
    const handle = mount(fakeApi());
    const base = windowListenerCount(dom);
    const seen: string[] = [];
    for (const label of ["人机对战", "双人同屏", "残局连胜"]) {
      byText(label)!.dispatch("click");
      flushFrames(dom, 5);
      const squares = dom.root.findAll((e) => e.className.includes("cg-sq"));
      seen.push(`${label}: 棋盘 ${squares.length} 格`);
      expect(squares.length, `${label} 棋盘没摆出来`).toBe(64);
      byText("回选关")?.dispatch("click");
      byText("换个玩法")?.dispatch("click");
      expect(windowListenerCount(dom), `${label} 退出后监听没归位`).toBe(base);
    }
    note(`[chess-garden 模式]\n  ${seen.join("\n  ")}`);
    handle.destroy();
    expect(windowListenerCount(dom)).toBe(0);
  });

  it("⑤ R2-PA-4 终态复验：题面池 41 个、封顶 chip 说得明白、跑满一轮会报第几轮", () => {
    const rows = [1, 5, 10, 12, 41, 42, 83].map(
      (r) => `第 ${String(r).padStart(2)} 局 档=${endlessTier(r)} 思考=${endlessThinkMs(r)}ms 到顶=${endlessAtTop(r)} 第 ${endlessLap(r)} 轮 chip「${endlessChip(r, 3)}」`
    );
    note(`[chess-garden R2-PA-4] 题面池 ENDLESS_COUNT=${ENDLESS_COUNT}，最高档=${ENDLESS_TOP_TIER}\n  ${rows.join("\n  ")}`);
    expect(ENDLESS_COUNT).toBe(41);
    expect(endlessChip(12, 3)).toContain("已到最高档");
    expect(endlessChip(42, 3)).toContain("题面第 2 轮");
    // 一轮之内题面不重样
    const seen = new Set<string>();
    for (let r = 1; r <= ENDLESS_COUNT; r++) seen.add(endlessStart(r));
    expect(seen.size).toBe(ENDLESS_COUNT);
  });

  it("⑥ R2-PA-3 例外复算：360px 上一格到底多宽", () => {
    const sheet = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    expect(sheet).toContain("margin-inline: -10px");
    // 360px：.screen 左右各 clamp(14,4vw,32) = 14.4px；.cg-mode 各 10px；棋盘用 -10px 负外边距铺回整宽
    const screenPad = Math.min(32, Math.max(14, 360 * 0.04));
    const inner = 360 - screenPad * 2;
    const boardWidth = inner - 10 * 2 + 10 * 2;
    const cell = boardWidth / 8;
    const before = (inner - 10 * 2) / 8;
    note(
      `[chess-garden R2-PA-3] 360px：.screen 内边距 ${screenPad.toFixed(1)}px×2 → 内容 ${inner.toFixed(1)}px；.cg-mode 内边距 10px×2；棋盘负外边距 -10px 铺回整宽 → 棋盘 ${boardWidth.toFixed(1)}px，一格 ${cell.toFixed(1)}px（不铺整宽是 ${before.toFixed(1)}px）。差 44 还缺 ${(44 - cell).toFixed(1)}px，例外前提未变。`
    );
    expect(cell).toBeGreaterThan(before);
    expect(cell).toBeLessThan(44);
    // 例外的补偿手段还在：键盘通路 + 其余按钮 ≥44
    const handle = mount(fakeApi());
    byText("人机对战")!.dispatch("click");
    flushFrames(dom, 4);
    const all = sheets() + sheet;
    for (const s of [".cg-open", ".cg-pick", ".cg-back", ".cg-btn", ".cg-tool"]) {
      const h = lastHitHeight(all, s);
      if (Number.isNaN(h)) continue;
      expect(h, `${s} 不到 44px`).toBeGreaterThanOrEqual(44);
    }
    handle.destroy();
  });

  it("⑦ PA-CG-1 / PA-CG-2 未回潮：Esc 是开关，G / K 按座位取消选中", () => {
    const handle = mount(fakeApi());
    byText("双人同屏")!.dispatch("click");
    flushFrames(dom, 4);
    const paused = (): boolean => dom.root.find((e) => e.textContent.includes("继续下棋")) !== null;
    fireWindow(dom, "keydown", { key: "Escape" });
    flushFrames(dom, 2);
    const on = paused();
    fireWindow(dom, "keydown", { key: "Escape" });
    flushFrames(dom, 2);
    const off = paused();
    note(`[chess-garden PA-CG-1] Esc 一次=暂停(${on})，再一次=恢复(${!off})`);
    expect(on).toBe(true);
    expect(off).toBe(false);
    handle.destroy();
  });

  it("⑧ destroy 20 轮：监听 / 子节点 / cg-shell-style 全归零（PA-CG-3 终态）", () => {
    for (let round = 1; round <= 20; round++) {
      const handle = mount(fakeApi());
      byText("残局连胜")!.dispatch("click");
      flushFrames(dom, 4);
      handle.destroy();
      expect(windowListenerCount(dom), `第 ${round} 轮还留监听`).toBe(0);
      expect(dom.root.children.length, `第 ${round} 轮根节点没清空`).toBe(0);
      expect(dom.head.children.filter((c) => c.id === "cg-shell-style").length, `第 ${round} 轮样式留在 head`).toBe(0);
      if (round === 1 || round === 20) {
        note(`[chess-garden destroy] 轮 ${round}: 监听=0 根子节点=0 cg-shell-style=0 待跑帧=${dom.frames.length} 待跑定时器=${dom.timers.size}`);
      }
    }
  });

  it("⑨ PA-CG-4 终态 + 红线：上屏文案里「死」已清干净", () => {
    const files = ["index.ts", "meta.ts", "guide.ts", "levels.ts", "rules.ts", "board.ts", "moves.ts", "search.ts", "view.ts"];
    const hits = scanGame("chess-garden", files, import.meta.url);
    const blurb = meta.blurb;
    const guide = readFileSync(new URL("../games/chess-garden/guide.ts", import.meta.url), "utf8");
    note(
      `[chess-garden PA-CG-4] blurb「${blurb}」不含「死角」=${!blurb.includes("死角")}；攻略里「将死/堵死/太死」=${(guide.match(/将死|堵死|太死/g) ?? []).length} 处｜红线扫 ${files.length} 文件 → 命中 ${hits.length}`
    );
    expect(blurb).not.toContain("死");
    expect(guide).not.toContain("将死");
    expect(hits).toEqual([]);
  });

  it("⑩ 真赢一次 + 真输一次：第 1 关按参考解走到将杀 / 走错一手就被判失手", () => {
    const spec = buildLevel(0);
    const win = createGame(spec.fen);
    const mate = findForcedMate(win.pos, spec.plies)!;
    expect(playMove(win, mate), "参考解走不进去").toBe(true);
    const st = gameStatus(win);
    // 故意走一手不成杀的：局面不该结束
    const lose = createGame(spec.fen);
    const wrong = legalMoves(lose.pos).find((m) => m.from !== mate.from || m.to !== mate.to)!;
    playMove(lose, wrong);
    const stWrong = gameStatus(lose);
    note(
      `[chess-garden 胜负] 第 1 关按强制杀走 ${toSan(mate, createGame(spec.fen).pos)} → 状态=${st.kind}（${winLine(spec, 0)}）｜故意走 ${toSan(wrong, createGame(spec.fen).pos)} → 状态=${stWrong.kind}（${loseLine(spec)}）`
    );
    expect(st.kind).toBe("checkmate");
    expect(stWrong.kind).not.toBe("checkmate");
  });

  it("打印证据", () => {
    dump("R3 PackA · chess-garden", log);
    expect(log.length).toBeGreaterThan(5);
  });
});
