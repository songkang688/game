import { describe, expect, it } from "vitest";
import {
  type Board,
  type Difficulty,
  type Player,
  analyzeWindow,
  bestMove,
  boardFull,
  candidateMoves,
  evaluateMaster,
  evaluatePoint,
  findVcf,
  findVct,
  findWinLine,
  forcingMoves,
  hintMove,
  hotPoints,
  isForbidden,
  killerPoints,
  makeBoard,
  makesFive,
  masterMove,
  setCell,
  threatMoves,
} from "./ai";

function put(b: Board, moves: Array<[number, number]>, p: Player): void {
  for (const [x, y] of moves) setCell(b, x, y, p);
}

describe("gomoku 胜负判定", () => {
  it("横向五连", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7], [7, 7]], 1);
    const line = findWinLine(b, 5, 7);
    expect(line).not.toBeNull();
    expect(line!.length).toBe(5);
  });

  it("斜向五连", () => {
    const b = makeBoard(15);
    put(b, [[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]], 2);
    expect(findWinLine(b, 4, 4)).not.toBeNull();
  });

  it("四连不算赢", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    expect(findWinLine(b, 5, 7)).toBeNull();
  });

  it("9×9 入门棋盘同样能判五连", () => {
    const b = makeBoard(9);
    put(b, [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]], 1);
    expect(findWinLine(b, 2, 2)).not.toBeNull();
  });

  it("makesFive：差一子成五", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    expect(makesFive(b, 7, 7, 1)).toBe(true);
    expect(makesFive(b, 2, 7, 1)).toBe(true);
    expect(makesFive(b, 8, 7, 1)).toBe(false);
    expect(makesFive(b, 7, 7, 2)).toBe(false);
  });

  it("boardFull", () => {
    const b = makeBoard(3);
    expect(boardFull(b)).toBe(false);
    for (let i = 0; i < 9; i++) b.cells[i] = 1;
    expect(boardFull(b)).toBe(true);
  });
});

describe("gomoku 棋型识别", () => {
  it("活四 / 冲四 / 活三", () => {
    expect(analyzeWindow("..xxxx...".slice(0, 9)).liveFour).toBe(true);
    const rush = analyzeWindow("oxxxx....");
    expect(rush.liveFour).toBe(false);
    expect(rush.fourDots).toBeGreaterThan(0);
    expect(analyzeWindow("...xxx...").liveThree).toBe(true);
    expect(analyzeWindow("..x.xx...").liveThree).toBe(true);
    expect(analyzeWindow("oxxx.....").liveThree).toBe(false);
  });

  it("评分：活三远高于活二", () => {
    const b = makeBoard(15);
    put(b, [[6, 7], [7, 7]], 1); // 已有两连
    const three = evaluatePoint(b, 8, 7, 1); // 下这里成活三
    const b2 = makeBoard(15);
    put(b2, [[6, 7]], 1);
    const two = evaluatePoint(b2, 7, 7, 1); // 只成活二
    expect(three).toBeGreaterThan(two * 5);
  });
});

describe("gomoku 普通档 AI（不会漏）", () => {
  it("自己能成五就直接赢", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 2); // AI 执白已有四连
    put(b, [[3, 8], [4, 8], [5, 8]], 1);
    const mv = bestMove(b, 2, "normal", () => 0)!;
    expect(makesFive(b, mv.x, mv.y, 2)).toBe(true);
  });

  it("必挡对方成五", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1); // 黑已四连（冲四）
    put(b, [[3, 8], [4, 8]], 2);
    const mv = bestMove(b, 2, "normal", () => 0)!;
    expect([[2, 7], [7, 7]]).toContainEqual([mv.x, mv.y]);
  });

  it("会堵对方的活三（活三检测）", () => {
    const b = makeBoard(15);
    put(b, [[6, 7], [7, 7], [8, 7]], 1); // 黑活三 ..xxx..
    put(b, [[6, 9]], 2);
    const mv = bestMove(b, 2, "normal", () => 0)!;
    // 挡两头任意一头都算对
    expect([[5, 7], [9, 7]]).toContainEqual([mv.x, mv.y]);
  });

  it("空棋盘先手下天元", () => {
    const b = makeBoard(15);
    const mv = bestMove(b, 1, "normal", () => 0)!;
    expect(mv).toEqual({ x: 7, y: 7 });
  });

  it("提示走法合法且是空位", () => {
    const b = makeBoard(9);
    put(b, [[4, 4]], 1);
    put(b, [[5, 5]], 2);
    const mv = hintMove(b, 1)!;
    expect(mv).not.toBeNull();
    expect(b.cells[mv.y * 9 + mv.x]).toBe(0);
  });
});

describe("gomoku 聪明档 AI（两层搜索）", () => {
  it("自己能成五就直接赢", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 2);
    put(b, [[3, 8], [4, 8], [5, 8]], 1);
    const mv = bestMove(b, 2, "smart", () => 0)!;
    expect(makesFive(b, mv.x, mv.y, 2)).toBe(true);
  });

  it("必挡对方成五", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    put(b, [[3, 8], [4, 8]], 2);
    const mv = bestMove(b, 2, "smart", () => 0)!;
    expect([[2, 7], [7, 7]]).toContainEqual([mv.x, mv.y]);
  });

  it("有活三时主动扩成活四", () => {
    const b = makeBoard(15);
    put(b, [[6, 7], [7, 7], [8, 7]], 1); // 黑活三
    put(b, [[0, 0], [14, 14]], 2);
    const mv = bestMove(b, 1, "smart", () => 0)!;
    expect([[5, 7], [9, 7]]).toContainEqual([mv.x, mv.y]);
  });

  it("会堵对方的活三", () => {
    const b = makeBoard(15);
    put(b, [[6, 7], [7, 7], [8, 7]], 1);
    put(b, [[6, 9]], 2);
    const mv = bestMove(b, 2, "smart", () => 0)!;
    expect([[5, 7], [9, 7]]).toContainEqual([mv.x, mv.y]);
  });

  it("两层搜索：能看见「对手下一手将形成双冲四」的危险点并规避/抢占", () => {
    // 黑有一个眠三 + 一个跳三共享点 (5,5)：白（聪明档）应优先占住这个焦点
    const b = makeBoard(15);
    put(b, [[2, 2], [3, 3], [4, 4]], 1); // 斜眠三（(1,1) 处被白挡）
    put(b, [[1, 1]], 2);
    put(b, [[5, 3], [5, 4]], 1); // 竖二
    put(b, [[5, 8], [8, 5]], 2);
    const mv = bestMove(b, 2, "smart", () => 0)!;
    // (5,5) 是黑棋的双威胁焦点（斜冲四 + 竖活三），聪明档要么占它要么堵斜线
    const good = [[5, 5], [6, 6], [5, 2], [5, 6]];
    expect(good).toContainEqual([mv.x, mv.y]);
  });

  it("空棋盘先手下天元", () => {
    const b = makeBoard(15);
    const mv = bestMove(b, 1, "smart", () => 0)!;
    expect(mv).toEqual({ x: 7, y: 7 });
  });
});

describe("gomoku 简单档 AI（会漏）", () => {
  it("rng 大时会漏掉必挡点", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1); // 黑冲四
    put(b, [[3, 9], [4, 9]], 2);
    const mv = bestMove(b, 2, "easy", () => 0.99)!;
    // 0.99 > 0.6 → 跳过挡五分支；又挑了第 3 名 → 不是挡点
    expect([[2, 7], [7, 7]]).not.toContainEqual([mv.x, mv.y]);
    // 但依然是合法空位
    expect(b.cells[mv.y * 15 + mv.x]).toBe(0);
  });

  it("rng 小时也能挡住", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    put(b, [[3, 9], [4, 9]], 2);
    const mv = bestMove(b, 2, "easy", () => 0)!;
    expect([[2, 7], [7, 7]]).toContainEqual([mv.x, mv.y]);
  });
});

describe("gomoku 禁手（默认关，可开）", () => {
  it("长连禁手", () => {
    const b = makeBoard(15);
    // x x x _ x x：在 (6,7) 落子成 6 连
    put(b, [[3, 7], [4, 7], [5, 7], [7, 7], [8, 7]], 1);
    const r = isForbidden(b, 6, 7);
    expect(r.forbidden).toBe(true);
    expect(r.reason).toContain("长连");
  });

  it("正好成五不算禁手", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    expect(isForbidden(b, 7, 7).forbidden).toBe(false);
  });

  it("双三禁手", () => {
    const b = makeBoard(15);
    // 横向 (5,7)(6,7) + 纵向 (7,5)(7,6)，在 (7,7) 落子形成两个活三
    put(b, [[5, 7], [6, 7], [7, 5], [7, 6]], 1);
    const r = isForbidden(b, 7, 7);
    expect(r.forbidden).toBe(true);
    expect(r.reason).toContain("双三");
  });

  it("普通的一手棋不禁", () => {
    const b = makeBoard(15);
    put(b, [[5, 7]], 1);
    expect(isForbidden(b, 6, 7).forbidden).toBe(false);
  });

  it("判定不改变棋盘", () => {
    const b = makeBoard(15);
    put(b, [[5, 7], [6, 7], [7, 5], [7, 6]], 1);
    isForbidden(b, 7, 7);
    expect(b.cells[7 * 15 + 7]).toBe(0);
  });
});

describe("gomoku 候选点", () => {
  it("只考虑棋子附近的空位", () => {
    const b = makeBoard(15);
    put(b, [[7, 7]], 1);
    const cands = candidateMoves(b);
    expect(cands.length).toBe(24); // 5x5 减去自身
    for (const [x, y] of cands) {
      expect(Math.abs(x - 7)).toBeLessThanOrEqual(2);
      expect(Math.abs(y - 7)).toBeLessThanOrEqual(2);
    }
  });
});

describe("gomoku AI 响应速度(思考中不卡 UI)", () => {
  /** 摆一个 15×15 中盘局面:40 手散布在中腹,候选点最多的场景 */
  function midGameBoard(): Board {
    const b = makeBoard(15);
    let p: Player = 1;
    let seed = 7;
    const rng = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let placed = 0;
    while (placed < 40) {
      const x = 2 + Math.floor(rng() * 11);
      const y = 2 + Math.floor(rng() * 11);
      if (b.cells[y * 15 + x] !== 0) continue;
      // 避免摆出现成的五连干扰测试
      setCell(b, x, y, p);
      if (findWinLine(b, x, y)) {
        setCell(b, x, y, 0);
        continue;
      }
      p = p === 1 ? 2 : 1;
      placed++;
    }
    return b;
  }

  it("聪明档中盘一步 < 100ms(同步计算不阻塞动画)", () => {
    const warm = midGameBoard();
    bestMove(warm, 2, "smart", () => 0); // 预热 JIT
    const b = midGameBoard();
    const t0 = performance.now();
    const mv = bestMove(b, 2, "smart", () => 0);
    const elapsed = performance.now() - t0;
    expect(mv).not.toBeNull();
    expect(elapsed).toBeLessThan(100);
  });

  it("简单/普通档同样在 100ms 内", () => {
    for (const d of ["easy", "normal"] as const) {
      const b = midGameBoard();
      const t0 = performance.now();
      expect(bestMove(b, 2, d, () => 0)).not.toBeNull();
      expect(performance.now() - t0).toBeLessThan(100);
    }
  });

  it("大师档要算杀，慢一些也得在 500ms 内出手", () => {
    const warm = midGameBoard();
    bestMove(warm, 2, "master", () => 0);
    const b = midGameBoard();
    const t0 = performance.now();
    expect(bestMove(b, 2, "master", () => 0)).not.toBeNull();
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

/* ================= 1.1 新增：棋灵象·大师档 ================= */

/** 固定种子的伪随机，保证对局可复现 */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 让两档 AI 从空棋盘对到分出胜负，返回赢家（0 = 下满平局） */
function duel(
  black: Difficulty,
  white: Difficulty,
  seed: number,
  size: number
): { winner: Player | 0; plies: number } {
  const b = makeBoard(size);
  const rng = lcg(seed);
  let cur: Player = 1;
  for (let ply = 0; ply < size * size; ply++) {
    const mv = bestMove(b, cur, cur === 1 ? black : white, rng);
    if (!mv) break;
    expect(b.cells[mv.y * size + mv.x], "AI 下到了非空点").toBe(0);
    setCell(b, mv.x, mv.y, cur);
    if (findWinLine(b, mv.x, mv.y)) return { winner: cur, plies: ply + 1 };
    if (boardFull(b)) break;
    cur = cur === 1 ? 2 : 1;
  }
  return { winner: 0, plies: size * size };
}

const SEEDS = [1, 7, 42, 99, 2024, 31337];

describe("gomoku 1.1 · 大师档的算杀本事", () => {
  it("forcingMoves 只挑冲四这种对手非挡不可的点", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7]], 1); // 黑活三
    const moves = forcingMoves(b, 1);
    // 活三还不是四，补成四的两个点才算强迫手
    const keys = moves.map((m) => `${m.x},${m.y}`);
    expect(keys).toContain("6,7");
    expect(keys).toContain("2,7");
    expect(keys).not.toContain("7,9");
  });

  it("threatMoves 比 forcingMoves 多认活三", () => {
    const b = makeBoard(15);
    put(b, [[6, 7], [7, 7]], 1); // 黑活二
    expect(forcingMoves(b, 1)).toHaveLength(0);
    const three = threatMoves(b, 1).map((m) => `${m.x},${m.y}`);
    expect(three).toContain("8,7");
  });

  it("killerPoints 找出活四点：一步造出两个成五点", () => {
    const b = makeBoard(15);
    put(b, [[5, 7], [6, 7], [7, 7]], 1); // 黑活三，两头都空
    const kp = killerPoints(b, 1).map((m) => `${m.x},${m.y}`);
    expect(kp).toContain("8,7");
    expect(kp).toContain("4,7");
    // 白棋在这儿什么都没有
    expect(killerPoints(b, 2)).toHaveLength(0);
  });

  it("hotPoints 认得出双活三这种要害点", () => {
    const b = makeBoard(15);
    put(b, [[5, 7], [6, 7], [7, 5], [7, 6]], 1); // (7,7) 同时接上横竖两个活三
    const hot = hotPoints(b, 1).map((m) => `${m.x},${m.y}`);
    expect(hot).toContain("7,7");
  });

  it("findVcf 算得出两手冲四的杀棋", () => {
    const b = makeBoard(15);
    put(b, [[4, 7], [5, 7], [6, 7], [5, 5], [5, 6]], 1);
    put(b, [[3, 7], [5, 9], [0, 0], [14, 14], [0, 14]], 2);
    const kill = findVcf(b, 1, 4);
    expect(kill).not.toBeNull();
    // 冲四点，白棋不得不挡
    setCell(b, kill!.x, kill!.y, 1);
    expect(candidateMoves(b).some(([x, y]) => makesFive(b, x, y, 1))).toBe(true);
  });

  it("findVcf 在没有杀棋时老老实实返回 null", () => {
    const b = makeBoard(15);
    put(b, [[7, 7]], 1);
    put(b, [[8, 8]], 2);
    expect(findVcf(b, 1, 5)).toBeNull();
    expect(findVct(b, 1, 3)).toBeNull();
  });

  it("findVct 认得出活四这种一步定胜负的形", () => {
    const b = makeBoard(15);
    put(b, [[5, 7], [6, 7], [7, 7]], 1);
    put(b, [[0, 0], [14, 14], [0, 14]], 2);
    const kill = findVct(b, 1, 3);
    expect(kill).not.toBeNull();
    expect([[4, 7], [8, 7]]).toContainEqual([kill!.x, kill!.y]);
  });

  it("evaluateMaster 看不上没有后续的冲四，但很看重活三", () => {
    const b = makeBoard(15);
    put(b, [[3, 7], [4, 7], [5, 7]], 1);
    put(b, [[2, 7]], 2); // 左边被堵，(6,7) 只是个冲四
    const rush = evaluateMaster(b, 6, 7, 1);
    const b2 = makeBoard(15);
    put(b2, [[6, 9], [7, 9]], 1);
    const three = evaluateMaster(b2, 8, 9, 1); // 活三
    expect(rush).toBeLessThan(three);
    // 而普通评估函数里冲四反而更高，两套权重确实不一样
    const bb = makeBoard(15);
    put(bb, [[3, 7], [4, 7], [5, 7]], 1);
    put(bb, [[2, 7]], 2);
    expect(evaluatePoint(bb, 6, 7, 1)).toBeGreaterThan(rush);
  });

  it("大师档该赢就赢、该挡就挡", () => {
    const win = makeBoard(15);
    put(win, [[3, 7], [4, 7], [5, 7], [6, 7]], 2);
    put(win, [[3, 8], [4, 8], [5, 8]], 1);
    const mv = masterMove(win, 2, () => 0)!;
    expect(makesFive(win, mv.x, mv.y, 2)).toBe(true);

    const block = makeBoard(15);
    put(block, [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
    put(block, [[3, 9], [4, 9]], 2);
    const mv2 = bestMove(block, 2, "master", () => 0)!;
    expect([[2, 7], [7, 7]]).toContainEqual([mv2.x, mv2.y]);
  });

  it("大师档会提前拆掉对手的双活三要害点", () => {
    const b = makeBoard(15);
    put(b, [[5, 7], [6, 7], [7, 5], [7, 6]], 1); // (7,7) 是黑棋的双活三点
    put(b, [[0, 0], [14, 14]], 2);
    const mv = bestMove(b, 2, "master", () => 0)!;
    // 要么直接占住要害点，要么把其中一条活三拆掉
    const good = [[7, 7], [4, 7], [8, 7], [7, 4], [7, 8]];
    expect(good).toContainEqual([mv.x, mv.y]);
  });

  it("大师档空棋盘先手下天元", () => {
    expect(bestMove(makeBoard(15), 1, "master", () => 0)).toEqual({ x: 7, y: 7 });
    expect(bestMove(makeBoard(9), 1, "master", () => 0)).toEqual({ x: 4, y: 4 });
  });
});

describe("gomoku 1.1 · 大师档实战对局（固定种子）", () => {
  it("大师档执黑，六个种子两种棋盘全胜简单档", () => {
    for (const size of [9, 15]) {
      for (const seed of SEEDS) {
        const r = duel("master", "easy", seed, size);
        expect(r.winner, `${size}×${size} 种子 ${seed}`).toBe(1);
      }
    }
  }, 120_000);

  // 五子棋黑棋先行本来就占便宜（正式比赛要靠禁手规则找补），
  // 所以后手的大师档只要求「大比分领先」，不要求一局不输。
  it("大师档执白对简单档也是大比分领先", () => {
    const seeds = [1, 3, 7, 11, 42, 99, 123, 777, 2024, 31337];
    let win = 0;
    let lose = 0;
    for (const seed of seeds) {
      const r = duel("easy", "master", seed, 15);
      if (r.winner === 2) win++;
      else if (r.winner === 1) lose++;
    }
    expect(win).toBeGreaterThanOrEqual(7);
    expect(win).toBeGreaterThan(lose * 2);
  }, 120_000);

  it("大师档在标准棋盘上黑白两边都赢得过聪明档", () => {
    for (const seed of SEEDS) {
      expect(duel("master", "smart", seed, 15).winner, `执黑 种子 ${seed}`).toBe(1);
      expect(duel("smart", "master", seed, 15).winner, `执白 种子 ${seed}`).toBe(2);
    }
  }, 180_000);

  it("大师档在标准棋盘上黑白两边都赢得过普通档", () => {
    for (const seed of SEEDS) {
      expect(duel("master", "normal", seed, 15).winner, `执黑 种子 ${seed}`).toBe(1);
      expect(duel("normal", "master", seed, 15).winner, `执白 种子 ${seed}`).toBe(2);
    }
  }, 180_000);

  it("同样的种子跑两遍，走的每一步都一模一样（对局可复现）", () => {
    const a = duel("master", "smart", 2024, 15);
    const b = duel("master", "smart", 2024, 15);
    expect(a).toEqual(b);
  }, 60_000);

  it("对局全程合法：没有落在已有棋子上，赢家确实连成了五", () => {
    const r = duel("master", "easy", 42, 15);
    expect(r.winner).toBe(1);
    expect(r.plies).toBeGreaterThan(4);
    expect(r.plies % 2).toBe(1); // 黑棋赢，落子数必为奇数
  }, 60_000);
});
