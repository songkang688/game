import { describe, expect, it } from "vitest";
import { FLAG, HIDDEN, OPEN, indexOf, safeZone } from "./board";
import { isLogicallySolvable } from "./solver";
import {
  chordAt,
  createRun,
  elapsedMs,
  expire,
  flagAt,
  flagBudgetLeft,
  moveRunCursor,
  openAt,
  restart,
  revealRest,
  runFlagCount,
  runFlagsLeft,
  runProgress,
  runSafeLeft,
  runWrongFlags,
  snapshot,
  timeLeftMs,
  timedOut
} from "./run";

function base(over: Partial<Parameters<typeof createRun>[0]> = {}) {
  return createRun({ w: 9, h: 9, mines: 10, seed: 2024, ...over });
}

describe("mine-garden · 首点必安全", () => {
  it("第一下之前地里一颗刺种都没有（种是点完才埋的）", () => {
    const run = base();
    expect(run.board.mines).toBe(0);
    expect(run.started).toBe(false);
    expect(run.phase).toBe("idle");
  });

  it("多个 seed、多个首点：第一下永远开出一片空地，8 邻格也干净", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const first of [0, indexOf(9, 8, 0), indexOf(9, 4, 4), indexOf(9, 8, 8)]) {
        const run = createRun({ w: 9, h: 9, mines: 10, seed });
        const res = openAt(run, first, 1000);
        expect(res.first).toBe(true);
        expect(res.hit).toBe(false);
        for (const i of safeZone(9, 9, first)) expect(run.board.mine[i]).toBe(0);
        // 首点的数字一定是 0，所以整个安全区至少会被一次性翻开
        expect(res.opened.length).toBeGreaterThanOrEqual(safeZone(9, 9, first).length);
        expect(run.board.hint[first]).toBe(0);
        expect(run.board.mines).toBe(10);
      }
    }
  });

  it("开了无猜的这一局，生成出来的图确实能一路推到底", () => {
    const run = base({ noGuess: true });
    const first = indexOf(9, 4, 4);
    openAt(run, first, 0);
    expect(run.noGuess).toBe(true);
    expect(isLogicallySolvable({ w: 9, h: 9, mine: run.board.mine }, first)).toBe(true);
  });

  it("计时从第一次翻开开始；先插旗不算开局", () => {
    const run = base();
    expect(elapsedMs(run, 5000)).toBe(0);
    flagAt(run, 0, 3000);
    expect(run.started).toBe(false);
    expect(run.board.mines).toBe(0);
    expect(elapsedMs(run, 5000)).toBe(0);
    openAt(run, indexOf(9, 4, 4), 4000);
    expect(run.startedAt).toBe(4000);
    expect(elapsedMs(run, 9000)).toBe(5000);
  });
});

describe("mine-garden · 保护", () => {
  it("开了保护：第一次踩到刺种当场改成插旗，本局继续", () => {
    const run = base({ protect: true });
    openAt(run, indexOf(9, 4, 4), 0);
    const spike = run.board.mine.indexOf(1);
    const res = openAt(run, spike, 100);
    expect(res.saved).toBe(true);
    expect(res.lose).toBe(false);
    expect(run.phase).toBe("playing");
    expect(run.board.state[spike]).toBe(FLAG);
    expect(run.usedProtect).toBe(true);
    expect(run.protectLeft).toBe(0);
  });

  it("保护只有一次，第二次踩到就结束", () => {
    const run = base({ protect: true });
    openAt(run, indexOf(9, 4, 4), 0);
    const spikes: number[] = [];
    for (let i = 0; i < run.board.mine.length; i++) if (run.board.mine[i]) spikes.push(i);
    openAt(run, spikes[0], 10);
    const res = openAt(run, spikes[1], 20);
    expect(res.saved).toBe(false);
    expect(res.lose).toBe(true);
    expect(run.phase).toBe("lost");
    expect(run.hitAt).toBe(spikes[1]);
  });

  it("没开保护：第一次踩到就结束，计时停在那一刻", () => {
    const run = base();
    openAt(run, indexOf(9, 4, 4), 1000);
    const spike = run.board.mine.indexOf(1);
    openAt(run, spike, 4000);
    expect(run.phase).toBe("lost");
    expect(elapsedMs(run, 99999)).toBe(3000);
  });

  it("结束之后再点也不会有任何变化", () => {
    const run = base();
    openAt(run, indexOf(9, 4, 4), 0);
    openAt(run, run.board.mine.indexOf(1), 10);
    const before = snapshot(run);
    const res = openAt(run, 0, 20);
    expect(res.kind).toBe("none");
    expect([...run.board.state]).toEqual([...before.state]);
  });
});

describe("mine-garden · 插旗与限旗", () => {
  it("插旗不算翻开，剩余小旗数跟着变", () => {
    const run = base();
    openAt(run, indexOf(9, 4, 4), 0);
    const before = runFlagsLeft(run);
    const res = flagAt(run, run.board.mine.indexOf(1), 10);
    expect(res.flag).toBe("flag");
    expect(runFlagCount(run)).toBe(1);
    expect(runFlagsLeft(run)).toBe(before - 1);
  });

  it("插了旗的格子点不动（防误触）", () => {
    const run = base();
    openAt(run, indexOf(9, 4, 4), 0);
    const spike = run.board.mine.indexOf(1);
    flagAt(run, spike, 10);
    const res = openAt(run, spike, 20);
    expect(res.opened).toHaveLength(0);
    expect(run.phase).toBe("playing");
  });

  it("限旗关：插到上限就插不动了，收一面又能插", () => {
    const run = createRun({ w: 9, h: 9, mines: 10, seed: 7, flagLimit: 2 });
    openAt(run, indexOf(9, 4, 4), 0);
    const hidden: number[] = [];
    for (let i = 0; i < 81; i++) if (run.board.state[i] === HIDDEN) hidden.push(i);
    expect(flagAt(run, hidden[0], 1).flag).toBe("flag");
    expect(flagAt(run, hidden[1], 2).flag).toBe("flag");
    expect(flagBudgetLeft(run)).toBe(0);
    const blocked = flagAt(run, hidden[2], 3);
    expect(blocked.blocked).toBe(true);
    expect(runFlagCount(run)).toBe(2);
    flagAt(run, hidden[0], 4);
    expect(flagBudgetLeft(run)).toBe(1);
  });

  it("不限旗的时候小旗预算是无限的", () => {
    const run = base();
    expect(flagBudgetLeft(run)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("mine-garden · 和弦", () => {
  it("旗插对了就能一次翻开一圈；旗插错了会真的踩到刺种", () => {
    const good = createRun({ w: 5, h: 5, mines: 3, seed: 11 });
    openAt(good, indexOf(5, 2, 2), 0);
    // 把所有刺种都插上旗，再对每个数字格和弦，整片地就扫完了
    for (let i = 0; i < 25; i++) if (good.board.mine[i]) flagAt(good, i, 1);
    for (let i = 0; i < 25; i++) if (good.board.state[i] === OPEN) chordAt(good, i, 2);
    expect(good.phase).toBe("won");

    const bad = createRun({ w: 5, h: 5, mines: 3, seed: 11 });
    openAt(bad, indexOf(5, 2, 2), 0);
    // 故意把旗插在空地上，凑够数字就和弦
    let hit = false;
    for (let i = 0; i < 25 && !hit; i++) {
      if (bad.board.state[i] !== OPEN || bad.board.hint[i] === 0) continue;
      const need = bad.board.hint[i];
      const wrong: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = (i % 5) + dx;
          const ny = Math.floor(i / 5) + dy;
          if (nx < 0 || ny < 0 || nx >= 5 || ny >= 5) continue;
          const nb = ny * 5 + nx;
          if (nb !== i && bad.board.state[nb] === HIDDEN && !bad.board.mine[nb]) wrong.push(nb);
        }
      }
      if (wrong.length < need) continue;
      for (let k = 0; k < need; k++) flagAt(bad, wrong[k], 1);
      const res = chordAt(bad, i, 2);
      if (res.hit) hit = true;
    }
    expect(hit, "旗全插错还硬和弦，一定会碰到刺种").toBe(true);
    expect(bad.phase).toBe("lost");
    expect(runWrongFlags(bad).length).toBeGreaterThan(0);
  });

  it("旗数不够时和弦什么都不做，也不算一手", () => {
    const run = base();
    openAt(run, indexOf(9, 4, 4), 0);
    const moves = run.moves;
    let numbered = -1;
    for (let i = 0; i < 81; i++) if (run.board.state[i] === OPEN && run.board.hint[i] > 0) numbered = i;
    const res = chordAt(run, numbered, 10);
    expect(res.opened).toHaveLength(0);
    expect(run.moves).toBe(moves);
  });
});

describe("mine-garden · 胜利与倒计时", () => {
  it("把非刺种格全翻开就赢了，旗插了几面都不影响", () => {
    const run = createRun({ w: 6, h: 6, mines: 4, seed: 5 });
    openAt(run, indexOf(6, 3, 3), 0);
    for (let i = 0; i < 36; i++) {
      if (!run.board.mine[i]) openAt(run, i, 10);
    }
    expect(run.phase).toBe("won");
    expect(runSafeLeft(run)).toBe(0);
    expect(runProgress(run)).toBe(1);
    // 赢了会自动把刺种补上小旗，纯粹是收尾好看
    expect(runFlagCount(run)).toBe(4);
  });

  it("倒计时归零就收场，没到点前一直是 playing", () => {
    const run = createRun({ w: 9, h: 9, mines: 10, seed: 3, timeLimitMs: 30000 });
    openAt(run, indexOf(9, 4, 4), 1000);
    expect(timeLeftMs(run, 11000)).toBe(20000);
    expect(timedOut(run, 11000)).toBe(false);
    expect(timedOut(run, 31000)).toBe(true);
    expire(run, 31000);
    expect(run.phase).toBe("lost");
    expect(elapsedMs(run, 99999)).toBe(30000);
  });

  it("不限时的时候剩余时间是无限的", () => {
    const run = base();
    expect(timeLeftMs(run, 5000)).toBe(Number.POSITIVE_INFINITY);
    expect(timedOut(run, 5000)).toBe(false);
  });
});

describe("mine-garden · 光标与收尾", () => {
  it("光标撞到边就停住，点哪儿光标就跟到哪儿", () => {
    const run = base();
    run.cursor = 0;
    expect(moveRunCursor(run, "left")).toBe(0);
    expect(moveRunCursor(run, "right")).toBe(1);
    openAt(run, indexOf(9, 4, 4), 0);
    expect(run.cursor).toBe(indexOf(9, 4, 4));
  });

  it("输了之后剩下的刺种排好队，一颗一颗慢慢开花", () => {
    const run = base();
    openAt(run, indexOf(9, 4, 4), 0);
    const spike = run.board.mine.indexOf(1);
    openAt(run, spike, 10);
    const order = revealRest(run);
    expect(order).not.toContain(spike);
    expect(order.length).toBeGreaterThan(0);
    expect(new Set(order).size).toBe(order.length);
  });

  it("重开一局会换一个派生 seed，别让孩子把同一张图背下来", () => {
    const run = base();
    const again = restart(run);
    expect(again.opts.seed).not.toBe(run.opts.seed);
    expect(again.opts.w).toBe(run.opts.w);
    expect(again.started).toBe(false);
    expect(again.board.mines).toBe(0);
  });
});
