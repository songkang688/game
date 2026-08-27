/**
 * 围子花园 · 两套计分
 *
 * 默认**数子法**(子 + 围空),设置里可以切到**数目法**(空目 + 提子)。
 * 两套都从同一份「归属地图」出发,区别只在算什么:
 *
 * - 归属:把死子先请回篮子,再对每一片空区做洪水填充。
 *   一片空区只挨着一方的子,整片归那一方;两方都挨着,整片算中立(单官 / 公气)。
 * - 数子法:活子数 + 归属空点数。中立点两边都不算,保证两边加起来 + 中立 = 全盘。
 * - 数目法:归属空点数 + 全局提子数(终局标死的对方子按提子算)。双活的公气不得目。
 *
 * 贴还:数子法黑贴 3¾ 子,数目法黑贴 6½ 目。让 n 子时黑再多贴 n
 * (数子多贴 n 子、数目多贴 n 目),这是本作定的换算,写在这里免得各处不一致。
 */
import {
  BLACK,
  EMPTY,
  WHITE,
  cloneBoard,
  neighborTable,
  other,
  type Board,
  type Color
} from "./board";
import { sekiPoints } from "./life";
import { play, type ScoreRule } from "./rules";

/** 数子法贴还:黑贴 3¾ 子 */
export const KOMI_CN = 3.75;
/** 数目法贴目:黑贴 6½ 目 */
export const KOMI_JP = 6.5;

export const RULE_LABELS: Record<ScoreRule, string> = {
  chinese: "数子法",
  japanese: "数目法"
};

export const RULE_HINTS: Record<ScoreRule, string> = {
  chinese: "数子法:先把单官填完,再数「自己的子 + 自己围住的空」,黑贴还 3¾ 子。",
  japanese: "数目法:只数「围住的空目 + 提到的子」,标死的子也算提子,黑贴 6½ 目。"
};

/** 让 n 子时黑要贴的总数 */
export function komiFor(rule: ScoreRule, handicap = 0): number {
  const base = rule === "chinese" ? KOMI_CN : KOMI_JP;
  return base + Math.max(0, Math.floor(handicap));
}

// ---------------------------------------------------------------------------
// 归属地图
// ---------------------------------------------------------------------------

export interface Territory {
  /** 归黑的空点 */
  black: number[];
  /** 归白的空点 */
  white: number[];
  /** 中立空点:单官与双活公气 */
  neutral: number[];
}

/** 把标死的子从盘面上拿掉,返回新盘面与各方被拿掉的子数 */
export function applyDead(board: Board, dead: readonly number[] = []): {
  board: Board;
  removed: Record<Color, number>;
} {
  const next = cloneBoard(board);
  const removed = { [BLACK]: 0, [WHITE]: 0 } as Record<Color, number>;
  for (const pt of dead) {
    const c = next.cells[pt];
    if (c === EMPTY) continue;
    removed[c as Color]++;
    next.cells[pt] = EMPTY;
  }
  return { board: next, removed };
}

/** 空区归属(传进来的盘面应当已经把死子拿掉了) */
export function territoryOf(board: Board): Territory {
  const table = neighborTable(board.size);
  const seen = new Uint8Array(board.cells.length);
  const out: Territory = { black: [], white: [], neutral: [] };
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] !== EMPTY || seen[i]) continue;
    const region: number[] = [];
    const stack = [i];
    seen[i] = 1;
    let touchBlack = false;
    let touchWhite = false;
    while (stack.length) {
      const cur = stack.pop() as number;
      region.push(cur);
      for (const n of table[cur]) {
        const c = board.cells[n];
        if (c === EMPTY) {
          if (!seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        } else if (c === BLACK) touchBlack = true;
        else touchWhite = true;
      }
    }
    const bucket = touchBlack && !touchWhite ? out.black : touchWhite && !touchBlack ? out.white : out.neutral;
    for (const p of region) bucket.push(p);
  }
  out.black.sort((a, b) => a - b);
  out.white.sort((a, b) => a - b);
  out.neutral.sort((a, b) => a - b);
  return out;
}

/** 单官:中立空点里去掉双活公气,剩下的就是可以填的单官 */
export function damePoints(board: Board, dead: readonly number[] = []): number[] {
  const { board: clean } = applyDead(board, dead);
  const seki = new Set(sekiPoints(clean));
  return territoryOf(clean).neutral.filter((p) => !seki.has(p));
}

/**
 * 填单官:从 startColor 开始轮流填,填不了(自杀)就换手再试。
 * 返回填完的盘面与填子顺序,数子法终局前走这一步。
 */
export function fillDame(board: Board, startColor: Color = BLACK, dead: readonly number[] = []): {
  board: Board;
  filled: Array<{ pt: number; color: Color }>;
} {
  let cur = applyDead(board, dead).board;
  const filled: Array<{ pt: number; color: Color }> = [];
  let color = startColor;
  // 每填一颗单官都会重算,因为填完可能让别的中立点变成某一方的地
  for (let guard = 0; guard < board.cells.length + 4; guard++) {
    const dame = damePoints(cur);
    if (dame.length === 0) break;
    let placed = false;
    for (const who of [color, other(color)]) {
      for (const pt of dame) {
        const res = play(cur, pt, who);
        if (!res) continue;
        cur = res.board;
        filled.push({ pt, color: who });
        color = other(who);
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) break;
  }
  return { board: cur, filled };
}

// ---------------------------------------------------------------------------
// 数子法(中国规则,默认)
// ---------------------------------------------------------------------------

export interface AreaScore {
  blackStones: number;
  whiteStones: number;
  blackTerritory: number;
  whiteTerritory: number;
  neutral: number;
  /** 黑的子 + 围空 */
  black: number;
  /** 白的子 + 围空 */
  white: number;
}

export function chineseScore(board: Board, dead: readonly number[] = []): AreaScore {
  const { board: clean } = applyDead(board, dead);
  const terr = territoryOf(clean);
  let blackStones = 0;
  let whiteStones = 0;
  for (let i = 0; i < clean.cells.length; i++) {
    if (clean.cells[i] === BLACK) blackStones++;
    else if (clean.cells[i] === WHITE) whiteStones++;
  }
  return {
    blackStones,
    whiteStones,
    blackTerritory: terr.black.length,
    whiteTerritory: terr.white.length,
    neutral: terr.neutral.length,
    black: blackStones + terr.black.length,
    white: whiteStones + terr.white.length
  };
}

// ---------------------------------------------------------------------------
// 数目法(日本规则,对战可切)
// ---------------------------------------------------------------------------

export interface PointScore {
  blackTerritory: number;
  whiteTerritory: number;
  /** 黑提到的白子(含终局标死的白子) */
  blackCaptures: number;
  whiteCaptures: number;
  black: number;
  white: number;
}

/**
 * 数目法。`captures` 是对局途中双方各自提掉的子数
 * (`captures[BLACK]` = 黑提掉的白子),终局标死的子按提子加进去。
 * 双活的公气两边都不得目。
 */
export function japaneseScore(
  board: Board,
  dead: readonly number[] = [],
  captures: Record<Color, number> = { [BLACK]: 0, [WHITE]: 0 } as Record<Color, number>
): PointScore {
  const { board: clean, removed } = applyDead(board, dead);
  const seki = new Set(sekiPoints(clean));
  const terr = territoryOf(clean);
  const blackTerritory = terr.black.filter((p) => !seki.has(p)).length;
  const whiteTerritory = terr.white.filter((p) => !seki.has(p)).length;
  const blackCaptures = (captures[BLACK] ?? 0) + removed[WHITE];
  const whiteCaptures = (captures[WHITE] ?? 0) + removed[BLACK];
  return {
    blackTerritory,
    whiteTerritory,
    blackCaptures,
    whiteCaptures,
    black: blackTerritory + blackCaptures,
    white: whiteTerritory + whiteCaptures
  };
}

// ---------------------------------------------------------------------------
// 判胜负
// ---------------------------------------------------------------------------

export type Winner = "black" | "white" | "draw";

export interface Verdict {
  rule: ScoreRule;
  black: number;
  white: number;
  komi: number;
  /** 黑的净胜(已经扣掉贴还),> 0 黑胜 */
  diff: number;
  winner: Winner;
  text: string;
}

/** 纯判定:黑的分、白的分、黑要贴多少 */
export function judge(rule: ScoreRule, black: number, white: number, komi: number): Verdict {
  const diff = Number((black - white - komi).toFixed(2));
  const winner: Winner = diff > 0 ? "black" : diff < 0 ? "white" : "draw";
  const unit = rule === "chinese" ? "子" : "目";
  const margin = Math.abs(diff);
  const text =
    winner === "draw"
      ? `不分上下,这一局是和棋!`
      : winner === "black"
        ? `鸭梨（黑）多了 ${margin} ${unit}。`
        : `康康（白）多了 ${margin} ${unit}。`;
  return { rule, black, white, komi, diff, winner, text };
}

export interface FinalOptions {
  rule: ScoreRule;
  dead?: readonly number[];
  captures?: Record<Color, number>;
  handicap?: number;
  /** 直接指定贴还,不传就按 komiFor 算(和棋用例会传 0) */
  komi?: number;
}

/** 终局结算:两套计分共用这个入口 */
export function finalScore(board: Board, opts: FinalOptions): Verdict {
  const komi = opts.komi ?? komiFor(opts.rule, opts.handicap ?? 0);
  if (opts.rule === "chinese") {
    const s = chineseScore(board, opts.dead ?? []);
    return judge("chinese", s.black, s.white, komi);
  }
  const s = japaneseScore(board, opts.dead ?? [], opts.captures);
  return judge("japanese", s.black, s.white, komi);
}

/** 结算面板上那几行小字 */
export function scoreLines(board: Board, opts: FinalOptions): string[] {
  if (opts.rule === "chinese") {
    const s = chineseScore(board, opts.dead ?? []);
    return [
      `鸭梨（黑）：子 ${s.blackStones} + 围空 ${s.blackTerritory} = ${s.black}`,
      `康康（白）：子 ${s.whiteStones} + 围空 ${s.whiteTerritory} = ${s.white}`,
      s.neutral > 0 ? `中立点 ${s.neutral}（单官与公气,两边都不算）` : "单官已经填完啦"
    ];
  }
  const s = japaneseScore(board, opts.dead ?? [], opts.captures);
  return [
    `鸭梨（黑）：空目 ${s.blackTerritory} + 提子 ${s.blackCaptures} = ${s.black}`,
    `康康（白）：空目 ${s.whiteTerritory} + 提子 ${s.whiteCaptures} = ${s.white}`,
    "双活的公气两边都不得目。"
  ];
}
