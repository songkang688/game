/**
 * 花园国际象棋 · 188 关战役（8 章）。
 *
 * 每一关都是一道有解的题：给一个 FEN、一个目标（N 步内将杀 / 吃到某枚子 / 走成和棋），
 * 再配一个档位的对手。杀棋题的「有解」由搜索验证，测试里会真的搜一遍。
 */
import { assertTotal, type Chapter } from "../level99";
import { parseFen, type Position } from "./board";
import type { Tier } from "./search";

export const CHAPTERS: Chapter[] = [
  { name: "兵的花园", emoji: "🌱", color: "#E8F2DC", desc: "只有兵和王，先学会兵怎么走怎么吃。", size: 24 },
  { name: "车的走廊", emoji: "🏰", color: "#E4EAF6", desc: "车走直线，一走就是一整条。", size: 24 },
  { name: "马的跳跃", emoji: "🐴", color: "#FBE7D8", desc: "马走日，还能跳过挡路的子。", size: 24 },
  { name: "象与后", emoji: "👑", color: "#F3E4F5", desc: "象走斜线，后是直线加斜线一起来。", size: 24 },
  { name: "易位课", emoji: "🔁", color: "#DFF0EE", desc: "王和车换个位置，四种情况下不能换。", size: 22 },
  { name: "过路与升变", emoji: "🌸", color: "#FDE8EE", desc: "吃过路兵只有一次机会，兵到底线要升变。", size: 22 },
  { name: "将杀练习", emoji: "🎯", color: "#FFF1D2", desc: "二到五步把对方的王请进死角。", size: 24 },
  { name: "花园杯", emoji: "🏆", color: "#E3F1E6", desc: "完整对局，从开局下到收官。", size: 24 },
];

export const TOTAL = 188;

export function chaptersValid(): boolean {
  return assertTotal(CHAPTERS, TOTAL, "chess-garden");
}

export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

export type Goal =
  | { kind: "mate"; inMoves: number }
  | { kind: "capture"; count: number }
  | { kind: "promote" }
  | { kind: "castle" }
  | { kind: "enpassant" }
  | { kind: "draw" }
  | { kind: "game" };

export interface LevelPlan {
  level: number;
  chapter: number;
  fen: string;
  goal: Goal;
  tier: Tier;
  /** 最多走几手（半回合），超了算没完成 */
  budget: number;
  /** 显示可走点提示 */
  showHints: boolean;
  hint: string;
}

/** 每一章的题库：按关号在库里轮着取，保证同一关永远是同一道题 */
const PAWN_PUZZLES = [
  "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1",
  "4k3/8/2p5/3P4/8/8/8/4K3 w - - 0 1",
  "4k3/8/8/2p5/3P4/8/8/4K3 w - - 0 1",
  "4k3/8/8/1p6/2P5/8/8/4K3 w - - 0 1",
];

const ROOK_PUZZLES = [
  "4k3/8/8/8/7p/8/8/R3K3 w Q - 0 1",
  "4k3/8/8/8/8/8/7r/R3K3 w Q - 0 1",
  "3k4/8/8/8/6p1/8/8/R2K4 w - - 0 1",
  "4k3/8/8/5p2/8/8/R7/4K3 w - - 0 1",
];

const KNIGHT_PUZZLES = [
  "4k3/8/3p4/8/8/1N6/8/4K3 w - - 0 1",
  "4k3/8/3p4/8/8/2N5/8/4K3 w - - 0 1",
  "4k3/8/8/3n4/8/8/8/1N2K3 w - - 0 1",
  "4k3/5p2/8/4N3/8/8/8/4K3 w - - 0 1",
];

const BISHOP_QUEEN_PUZZLES = [
  "4k3/8/8/5p2/8/8/8/2B1K3 w - - 0 1",
  "4k3/8/8/8/3p4/8/8/3QK3 w - - 0 1",
  "4k3/8/8/3b4/8/8/8/2B1K3 w - - 0 1",
  "4k3/2p5/8/8/8/8/8/3QK3 w - - 0 1",
];

const CASTLE_PUZZLES = [
  "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
  "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
  "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
  "r3k3/8/8/8/8/8/8/R3K2R w KQq - 0 1",
];

const SPECIAL_PUZZLES = [
  "4k3/8/8/8/4p3/8/3P4/4K3 w - - 0 1",
  "5k2/4P3/8/8/8/8/8/4K3 w - - 0 1",
  "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
  "4k3/8/8/2pP4/8/8/8/4K3 w - c6 0 1",
];

/**
 * 将杀题：全部是白方先走、真的存在强制杀的局面。
 * `inMoves` 是最少几步，测试里会用穷举验证器再搜一遍，摆错了立刻红。
 */
const MATE_PUZZLES: Array<{ fen: string; inMoves: number }> = [
  { fen: "6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1", inMoves: 1 },
  { fen: "3k4/8/3K4/8/8/8/8/7R w - - 0 1", inMoves: 1 },
  { fen: "7k/6pp/8/8/8/8/8/R6K w - - 0 1", inMoves: 1 },
  { fen: "6k1/8/6K1/8/8/8/8/7R w - - 0 1", inMoves: 2 },
  { fen: "4k3/8/4K3/8/8/8/8/3Q4 w - - 0 1", inMoves: 2 },
  { fen: "8/8/8/8/8/4K3/8/R5k1 w - - 0 1", inMoves: 3 },
  { fen: "6k1/8/8/6K1/8/8/8/R7 w - - 0 1", inMoves: 3 },
];

const GAME_FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
  "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
];

export function planFor(level: number): LevelPlan {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(level)));
  const chapter = chapterIndexOf(lv);
  let acc = 0;
  for (let i = 0; i < chapter; i++) acc += CHAPTERS[i].size;
  const k = lv - acc;
  const size = CHAPTERS[chapter].size;
  const ramp = size <= 1 ? 0 : k / (size - 1);

  const tier: Tier = chapter <= 1 ? "rookie" : chapter <= 3 ? "normal" : chapter <= 5 ? "normal" : chapter === 6 ? "pro" : ramp > 0.5 ? "hell" : "pro";
  const showHints = chapter <= 4;

  if (chapter === 6) {
    const puzzle = MATE_PUZZLES[k % MATE_PUZZLES.length];
    return {
      level: lv,
      chapter,
      fen: puzzle.fen,
      goal: { kind: "mate", inMoves: puzzle.inMoves },
      tier: "pro",
      budget: puzzle.inMoves * 2 + 2,
      showHints: false,
      hint: `${puzzle.inMoves} 步之内把对方的王请进死角。`,
    };
  }

  if (chapter === 7) {
    return {
      level: lv,
      chapter,
      fen: GAME_FENS[k % GAME_FENS.length],
      goal: { kind: "game" },
      tier,
      budget: 200,
      showHints: false,
      hint: "完整一局，赢下来就过关。",
    };
  }

  const pools = [PAWN_PUZZLES, ROOK_PUZZLES, KNIGHT_PUZZLES, BISHOP_QUEEN_PUZZLES, CASTLE_PUZZLES, SPECIAL_PUZZLES];
  const pool = pools[chapter];
  const fen = pool[k % pool.length];
  const goal: Goal =
    chapter === 4
      ? { kind: "castle" }
      : chapter === 5
        ? k % 4 === 3
          ? { kind: "enpassant" }
          : k % 4 === 1 || k % 4 === 2
            ? { kind: "promote" }
            : { kind: "capture", count: 1 }
        : { kind: "capture", count: 1 };
  const hint =
    chapter === 4
      ? "把王和车换个位置就算过关。"
      : goal.kind === "promote"
        ? "把兵送到底线升变。"
        : goal.kind === "enpassant"
          ? "抓住这一手，吃过路兵。"
          : "请对方的一枚棋子去花园里休息。";

  return {
    level: lv,
    chapter,
    fen,
    goal,
    tier,
    budget: chapter <= 1 ? 30 : 40,
    showHints,
    hint,
  };
}

export function positionFor(level: number): Position {
  return parseFen(planFor(level).fen);
}

export function goalText(plan: LevelPlan): string {
  switch (plan.goal.kind) {
    case "mate":
      return `${plan.goal.inMoves} 步将杀`;
    case "capture":
      return `吃到 ${plan.goal.count} 枚`;
    case "promote":
      return "送兵升变";
    case "castle":
      return "完成易位";
    case "enpassant":
      return "吃过路兵";
    case "draw":
      return "走成和棋";
    default:
      return "赢下这一局";
  }
}

/** 三星门槛：手数越少越漂亮 */
export function rateLevel(plies: number, budget: number): 1 | 2 | 3 {
  if (plies <= Math.max(1, Math.ceil(budget * 0.35))) return 3;
  if (plies <= Math.ceil(budget * 0.7)) return 2;
  return 1;
}

/** 无尽：连胜越多，对手越强 */
export function endlessPlan(streak: number): { tier: Tier; fen: string } {
  const tier: Tier = streak >= 9 ? "hell" : streak >= 5 ? "pro" : streak >= 2 ? "normal" : "rookie";
  return { tier, fen: GAME_FENS[streak % GAME_FENS.length] };
}
