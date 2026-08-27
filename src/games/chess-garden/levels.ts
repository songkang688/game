/**
 * 花园国际象棋 · 188 关题库。
 *
 * 八章 188 关，`assertTotal(CHAPTERS, 188)` 锁死总数。
 * 每一关都是一道**用搜索验证过**的题目：题面是 FEN，验证跑在 `levels.test.ts` 里——
 *  - 杀棋题：`findForcedMate(pos, plies)` 必须找得到解，`plies - 2` 必须找不到（正好 N 步杀）；
 *  - 逼和 / 子力不足 / 50 回合题：那一手走完 `status` 必须给出对应的和棋；
 *  - 三次重复题：按主线走完，黑方每一步都是唯一应手，最后 `status` 必须是重复和。
 *
 * 本文件只放数据与拼装，不跑搜索，所以进游戏是零延迟的。
 */
import { type Chapter } from "../level99";
import type { AiTier } from "./search";

export const CHAPTERS: Chapter[] = [
  {
    name: "兵的花园",
    emoji: "🌱",
    color: "#F3E7D3",
    desc: "只有兵和王。兵走到底线要升变，一步就能把局面翻过来。",
    size: 24,
  },
  {
    name: "车的走廊",
    emoji: "🏛️",
    color: "#E7EEF6",
    desc: "车管直线。把对方的王赶到边线，再顺着走廊照过去。",
    size: 24,
  },
  {
    name: "马的跳跃",
    emoji: "🐴",
    color: "#EFE6F6",
    desc: "马走日，能跳过挡路的子。学会用马同时叉两个目标。",
    size: 24,
  },
  {
    name: "象与后",
    emoji: "💎",
    color: "#E6F3EC",
    desc: "象走斜线，后是直线加斜线。两个子合力，网就收紧了。",
    size: 24,
  },
  {
    name: "易位课",
    emoji: "🏰",
    color: "#F6EDE2",
    desc: "王和车一起动的那一手。王进角落，车走到中间来帮忙。",
    size: 22,
  },
  {
    name: "过路与升变",
    emoji: "🌸",
    color: "#F9E9F0",
    desc: "对方的兵刚冲过两格，你的兵可以立刻吃过路——只有这一手有效。",
    size: 22,
  },
  {
    name: "将杀练习",
    emoji: "🎯",
    color: "#EDEAF7",
    desc: "两步到四步的强制杀。每一手都要算准对方的所有应招。",
    size: 24,
  },
  {
    name: "花园杯",
    emoji: "🏆",
    color: "#FDF0DA",
    desc: "残局任务：有的要将杀，有的反过来——想办法把这一局稳稳走成和棋。",
    size: 24,
  },
];

/** 题面数据：`[FEN, 参考解]`。参考解只给测试与「这一手不对」的判定用，界面上不展示。 */
const FAM: Record<string, Array<readonly [string, string]>> = {
  p1: [
    ["6k1/2P3pp/4P3/6p1/8/8/2K5/8 w - - 0 1", "c8=Q#"],
    ["4k3/3ppp1P/8/7p/8/8/3P4/K7 w - - 0 1", "h8=Q#"],
    ["6k1/4Pppp/8/8/8/1K4p1/3P4/8 w - - 0 1", "e8=Q#"],
    ["1k6/ppp3P1/1P6/2K5/1p6/8/8/8 w - - 0 1", "g8=Q#"],
    ["3k4/P1ppp3/8/2P5/8/5p2/8/7K w - - 0 1", "a8=Q#"],
    ["5k2/P3ppp1/3P4/8/8/8/6p1/6K1 w - - 0 1", "a8=Q#"],
    ["4k3/1P1ppp2/3p4/8/8/5P2/8/4K3 w - - 0 1", "b8=Q#"],
    ["1K2k3/2Pppp2/8/2p1P3/8/8/8/8 w - - 0 1", "c8=Q#"],
    ["2k5/1ppp2P1/p4P2/8/8/1K6/8/8 w - - 0 1", "g8=Q#"],
    ["1k6/pp1P4/8/6P1/8/3K1p2/8/8 w - - 0 1", "d8=Q#"],
    ["2k5/1ppp3P/8/8/6K1/8/P5p1/8 w - - 0 1", "h8=Q#"],
    ["4k3/1P1ppp2/1P6/8/3K4/7p/8/8 w - - 0 1", "b8=Q#"],
    ["2k5/Pppp3K/6P1/8/8/5p2/8/8 w - - 0 1", "a8=Q#"],
    ["3k4/2pppP2/8/1P6/8/4K2p/8/8 w - - 0 1", "f8=Q#"],
  ],
  p2: [
    ["1k6/p1pP4/5pK1/P7/8/8/8/8 w - - 0 1", "a6"],
    ["5k1K/3pppp1/5P2/1P6/8/8/8/8 w - - 0 1", "fxg7+"],
    ["3k4/2pppK2/1P1p4/8/8/2P5/8/8 w - - 0 1", "b7"],
    ["4k3/3p1pP1/8/4K3/8/3P4/5p2/8 w - - 0 1", "Kd6"],
    ["1K1k4/2p1p3/3PP3/4p3/8/8/8/8 w - - 0 1", "dxc7+"],
    ["4k3/1P1pp2K/8/4P3/1p6/8/8/8 w - - 0 1", "b8=Q+"],
    ["2k5/1p1pP3/8/2K5/5p2/8/P7/8 w - - 0 1", "Kb6"],
    ["3K2k1/4Pp1p/7p/6P1/8/8/8/8 w - - 0 1", "gxh6"],
    ["2k5/Kppp4/2p1P3/8/1P6/8/8/8 w - - 0 1", "e7"],
    ["6k1/4Kppp/2P3P1/8/8/7p/8/8 w - - 0 1", "gxf7+"],
    ["1k1K4/ppp5/1P6/8/4P3/8/6p1/8 w - - 0 1", "bxc7+"],
    ["2k5/Kp1p1P2/3p4/8/8/8/2P5/8 w - - 0 1", "Kb6"],
    ["6k1/5p1p/P4K1P/8/3p4/8/8/8 w - - 0 1", "a7"],
    ["4k3/3p1p1P/5p2/3K2P1/8/8/8/8 w - - 0 1", "h8=Q+"],
  ],
  r1: [
    ["5k2/4ppp1/8/1R6/8/8/2K5/8 w - - 0 1", "Rb8#"],
    ["3k4/2ppp3/7K/5R2/8/8/8/8 w - - 0 1", "Rf8#"],
    ["6k1/1K3ppp/3R4/8/8/8/8/8 w - - 0 1", "Rd8#"],
    ["2k5/1ppp4/8/8/6K1/7R/8/8 w - - 0 1", "Rh8#"],
    ["1k6/ppp5/5R2/8/8/8/8/1K6 w - - 0 1", "Rf8#"],
    ["5k2/R3ppp1/8/K7/8/8/8/8 w - - 0 1", "Ra8#"],
    ["3k4/2ppp3/8/6R1/8/8/5K2/8 w - - 0 1", "Rg8#"],
    ["1k6/ppp5/8/8/8/8/3R4/3K4 w - - 0 1", "Rd8#"],
    ["2k5/1ppp1R2/8/8/8/8/8/3K4 w - - 0 1", "Rf8#"],
    ["5k2/R3ppp1/8/8/7K/8/8/8 w - - 0 1", "Ra8#"],
    ["5k2/4ppp1/8/8/5K2/3R4/8/8 w - - 0 1", "Rd8#"],
    ["2k5/1ppp4/8/5R2/8/8/2K5/8 w - - 0 1", "Rf8#"],
  ],
  r2: [
    ["3k4/5R2/4R3/8/5K2/5p2/8/8 w - - 0 1", "Kxf3"],
    ["8/8/k3p3/8/7R/2K5/3R4/8 w - - 0 1", "Rb4"],
    ["8/k7/8/8/6R1/5R1p/1K6/8 w - - 0 1", "Rb3"],
    ["3k4/6R1/K7/2R5/3p4/8/8/8 w - - 0 1", "Rh5"],
    ["k7/8/8/8/1K6/1p4R1/4R3/8 w - - 0 1", "Re7"],
    ["8/6K1/k7/8/4p3/5R2/8/7R w - - 0 1", "Rb3"],
    ["k7/7R/8/3p4/8/1R6/5K2/8 w - - 0 1", "Re3"],
    ["4R3/7k/8/8/8/1pK5/8/6R1 w - - 0 1", "Kxb3"],
    ["8/1k3K2/8/8/2Rp4/6R1/8/8 w - - 0 1", "Rb3+"],
    ["8/1R6/k3K3/7p/8/8/8/5R2 w - - 0 1", "Rb3"],
    ["1K1k4/8/8/8/1RR5/8/7p/8 w - - 0 1", "Rb7"],
    ["6k1/4RR2/7K/8/8/8/5p2/8 w - - 0 1", "Rxf2"],
    ["k7/8/8/5R2/3p2RK/8/8/8 w - - 0 1", "Rg7"],
    ["8/1p2K3/7k/1R6/1R6/8/8/8 w - - 0 1", "Kf7"],
    ["k7/8/4R3/8/5R2/2p5/8/2K5 w - - 0 1", "Rf7"],
    ["k7/8/8/8/2R5/4R3/1K5p/8 w - - 0 1", "Rb3"],
  ],
  n1: [
    ["R2N1k2/5pp1/8/5p2/1N5K/8/8/8 w - - 0 1", "Ndc6#"],
    ["1NR1N1k1/5pp1/8/3p4/5K2/8/8/8 w - - 0 1", "Nf6#"],
    ["6k1/5ppp/4p1N1/1K3N2/8/8/5R2/8 w - - 0 1", "Nfe7#"],
    ["R1N3k1/5ppp/5p2/8/8/4N3/2K5/8 w - - 0 1", "Ne7#"],
    ["2kN2RK/1ppp4/8/8/8/7N/5p2/8 w - - 0 1", "Nf7#"],
    ["4k3/3ppp2/4N3/p2N4/8/4RK2/8/8 w - - 0 1", "Ndc7#"],
    ["3k4/2ppp3/3Np3/N7/4K3/R7/8/8 w - - 0 1", "Nab7#"],
    ["2R1Nk2/4p1p1/8/8/6p1/8/K3N3/8 w - - 0 1", "Nd6#"],
    ["3N1kNR/4ppp1/8/8/7p/K7/8/8 w - - 0 1", "Nh6#"],
    ["3k4/p1ppp3/3N3K/6N1/8/8/4R3/8 w - - 0 1", "Ngf7#"],
    ["5kNR/4ppp1/8/2p5/6N1/6K1/8/8 w - - 0 1", "N8h6#"],
    ["2R1Nk2/4ppp1/8/8/7K/4p3/8/6N1 w - - 0 1", "Nf6#"],
  ],
  n2: [
    ["8/K5kp/8/5QN1/8/1r6/8/8 w - - 0 1", "Ne6+"],
    ["1k6/3QN3/8/1p6/7r/8/8/3K4 w - - 0 1", "Nc6+"],
    ["3k4/1K4Q1/8/N7/5p2/8/8/r7 w - - 0 1", "Nc6+"],
    ["k3N2K/2Q5/3r4/8/8/p7/8/8 w - - 0 1", "Nxd6"],
    ["3k4/NQ6/8/8/6r1/5p2/7K/8 w - - 0 1", "Nc6+"],
    ["3k4/1Q6/8/8/p2N4/8/4K3/1r6 w - - 0 1", "Nc6+"],
    ["4k1K1/7Q/8/8/4N3/7r/3p4/8 w - - 0 1", "Nf6+"],
    ["8/k1K5/8/8/1N5p/1Q6/8/r7 w - - 0 1", "Nc6+"],
    ["8/k4r2/5p2/NQ6/4K3/8/8/8 w - - 0 1", "Nc6+"],
    ["8/kNQ5/p7/8/8/3r4/8/7K w - - 0 1", "Nd8+"],
    ["2k5/4Q1K1/8/5N2/5p2/8/5r2/8 w - - 0 1", "Nd6+"],
    ["k7/8/K7/8/8/p1N3Q1/8/1r6 w - - 0 1", "Nxb1"],
    ["1K1k4/Q7/8/N2p4/8/5r2/8/8 w - - 0 1", "Nc6+"],
    ["5k2/4N2K/3Q1p2/8/8/8/r7/8 w - - 0 1", "Ng8+"],
    ["1r6/8/k7/8/1Q2N3/4p3/2K5/8 w - - 0 1", "Nc5+"],
    ["2k2K2/Q7/8/7r/4N3/8/6p1/8 w - - 0 1", "Nd6+"],
  ],
  b1: [
    ["2R1Bk1K/4p1p1/8/8/6p1/8/2B5/8 w - - 0 1", "Beg6#"],
    ["3k4/3ppK2/2R5/6B1/8/8/1p6/5B2 w - - 0 1", "Bxe7#"],
    ["2k3BR/1ppp3p/8/8/8/8/2BK4/8 w - - 0 1", "Bgxh7#"],
    ["RB1k2K1/2ppp3/8/8/8/8/5p1B/8 w - - 0 1", "Bbxc7#"],
    ["1kB1R3/ppp5/3B4/1p6/8/8/8/7K w - - 0 1", "Bd7#"],
    ["5k2/3B1p2/8/8/6R1/3pB3/8/1K6 w - - 0 1", "Bc5#"],
    ["R3B1k1/5ppp/2p5/7K/8/8/6B1/8 w - - 0 1", "Bexc6#"],
    ["5k1K/4ppp1/3p4/8/B6R/8/8/B7 w - - 0 1", "Bxg7#"],
    ["1K1k3B/2pp4/7p/8/5B2/8/8/4R3 w - - 0 1", "Bxc7#"],
    ["1k1B2R1/ppp4K/8/3B1p2/8/8/8/8 w - - 0 1", "Be7#"],
    ["3kBR2/2ppp3/8/2B5/8/1p6/8/1K6 w - - 0 1", "Bf7#"],
    ["1k2B2R/ppp5/8/1B6/8/1p4K1/8/8 w - - 0 1", "Bed7#"],
  ],
  q2: [
    ["4k3/6pK/5B2/6Q1/8/8/6n1/8 w - - 0 1", "Qxg7"],
    ["4K1k1/2Q2p2/8/5B2/8/8/8/3n4 w - - 0 1", "Qxf7+"],
    ["8/k1K5/8/8/1nQ5/4p3/B7/8 w - - 0 1", "Qxb4"],
    ["7k/4B3/8/2n3Q1/3K4/8/p7/8 w - - 0 1", "Bf6+"],
    ["k7/4K2p/8/6B1/8/8/2Q5/7n w - - 0 1", "Qc8+"],
    ["K2B4/8/k5n1/2p4Q/8/8/8/8 w - - 0 1", "Qe2+"],
    ["1k6/5p2/4Q3/8/8/3n3B/8/5K2 w - - 0 1", "Qb6+"],
    ["6k1/8/2Q5/7p/8/6B1/6K1/n7 w - - 0 1", "Qg6+"],
    ["8/4p3/k1K5/2n5/8/2Q5/1B6/8 w - - 0 1", "Qa3+"],
    ["3K4/8/2k5/7Q/2pB4/8/8/7n w - - 0 1", "Qc5+"],
    ["8/6k1/4B3/6Kn/8/3p3Q/8/8 w - - 0 1", "Qxh5"],
    ["2B5/8/1n5k/3Q1K2/p7/8/8/8 w - - 0 1", "Qf7"],
    ["6Q1/8/4B2k/1K2p3/8/6n1/8/8 w - - 0 1", "Bf7"],
    ["2n3k1/8/3Q4/8/4p3/2B4K/8/8 w - - 0 1", "Qf6"],
    ["6k1/1p6/n6K/4B3/8/3Q4/8/8 w - - 0 1", "Qg6+"],
    ["1Q6/p3n3/k7/3B4/8/8/8/2K5 w - - 0 1", "Bc4+"],
  ],
  c1: [
    ["5k2/4p1pp/2B4N/7p/8/8/4P3/4K2R w K - 0 1", "O-O#"],
    ["5k2/4p1pp/7N/8/B3N3/8/pp2B3/4K2R w K - 0 1", "O-O#"],
    ["3k4/2p1p2p/1N6/7B/4p3/8/7N/R3K3 w Q - 0 1", "O-O-O#"],
    ["5k2/4p1pp/2B4N/8/8/8/7P/4K2R w K - 0 1", "O-O#"],
    ["3k4/2p1p2p/1N6/7B/8/8/8/R3K3 w Q - 0 1", "O-O-O#"],
    ["5k2/4p1p1/7N/8/B7/1p6/2p5/2Q1K2R w K - 0 1", "O-O#"],
  ],
  c2: [
    ["1r2N3/p7/p3k3/8/8/3Q4/8/R3K2R w KQ - 0 1", "O-O"],
    ["1r6/7N/3k4/8/2Q5/p1p5/8/R3K2R w KQ - 0 1", "O-O-O+"],
    ["3rk3/8/5Q2/2N4p/8/6p1/8/R3K2R w KQ - 0 1", "O-O"],
    ["3Q4/1r6/4k1N1/3p4/7p/8/8/R3K2R w KQ - 0 1", "O-O"],
    ["1r1k4/8/1N5p/8/5Q2/6p1/8/R3K2R w KQ - 0 1", "O-O-O+"],
    ["4r3/7p/4k3/2p5/8/5Q2/1N6/R3K2R w KQ - 0 1", "O-O-O"],
    ["7r/8/N2k2p1/7p/8/5Q2/8/R3K2R w KQ - 0 1", "O-O-O+"],
    ["8/4p3/r3k3/1Q6/2Np4/8/8/R3K2R w KQ - 0 1", "O-O"],
    ["8/2pk4/6p1/N7/8/8/5Qr1/R3K2R w KQ - 0 1", "O-O-O+"],
    ["3k1r2/8/6p1/N7/p7/5Q2/8/R3K2R w KQ - 0 1", "O-O-O+"],
    ["8/r1p1k3/p7/3Q4/8/7N/8/R3K2R w KQ - 0 1", "O-O"],
    ["r7/8/4k3/p7/p2Q2N1/8/8/R3K2R w KQ - 0 1", "O-O"],
    ["r7/4p3/4k3/p7/6N1/8/3Q4/R3K2R w KQ - 0 1", "O-O"],
    ["2rk4/2p5/7p/8/8/2N2Q2/8/R3K2R w KQ - 0 1", "O-O-O+"],
    ["8/5Qr1/3k4/2p1N3/8/p7/8/R3K2R w KQ - 0 1", "O-O-O+"],
    ["r2k4/8/1N6/8/5Q2/p5p1/8/R3K2R w KQ - 0 1", "O-O-O+"],
    ["4r3/4k3/2p5/8/3Q2pN/8/8/R3K2R w KQ - 0 1", "O-O"],
    ["3r1Q2/3k4/8/N5p1/8/p7/8/R3K2R w KQ - 0 1", "O-O-O+"],
  ],
  e1: [
    ["8/5K2/7k/5Ppp/6R1/4B3/8/8 w - g6 0 1", "fxg6#"],
    ["3R4/k4p2/2K5/Pp6/8/8/4B3/8 w - b6 0 1", "axb6#"],
    ["8/k1K5/p3R3/Pp6/4B3/8/8/8 w - b6 0 1", "axb6#"],
    ["8/k1K5/8/Pp2p3/R5B1/8/8/8 w - b6 0 1", "axb6#"],
    ["8/8/5K1k/6pP/8/p3B2R/8/8 w - g6 0 1", "hxg6#"],
    ["k7/2K5/8/Pp6/8/8/R2Bp3/8 w - b6 0 1", "axb6#"],
    ["8/k1K5/8/Pp6/RB5p/8/8/8 w - b6 0 1", "axb6#"],
    ["4R3/pk6/8/1KPp4/8/8/6B1/8 w - d6 0 1", "cxd6#"],
    ["8/k1K5/3p4/Pp6/8/R7/8/5B2 w - b6 0 1", "axb6#"],
  ],
  e2: [
    ["8/6k1/8/1K4Pp/5R2/1p6/8/2n3Q1 w - h6 0 1", "gxh6+"],
    ["6k1/2Q5/3p4/pP6/8/8/1R6/6Kn w - a6 0 1", "bxa6"],
    ["k7/7Q/p7/2pP4/R7/8/n5K1/8 w - c6 0 1", "dxc6"],
    ["7k/8/8/pn3pP1/8/3Q4/8/6RK w - f6 0 1", "gxf6"],
    ["k7/5p2/8/pP5R/8/1Q3Kn1/8/8 w - a6 0 1", "bxa6"],
    ["7k/2Q5/8/6pP/5n2/7R/7p/3K4 w - g6 0 1", "hxg6+"],
  ],
  un: [
    ["8/pP1R4/1pk5/R7/8/7K/1N2R1p1/8 w - - 0 1", "b8=N#"],
    ["8/1P1p1P1k/1K4R1/2P3p1/8/8/1B6/8 w - - 0 1", "f8=N#"],
    ["7Q/Q4P2/6k1/8/5K2/8/3N4/N7 w - - 0 1", "f8=N#"],
    ["2N5/2r1P3/5kp1/3Q4/B1p5/8/8/5K2 w - - 0 1", "e8=N#"],
    ["8/6P1/7k/3Q4/8/5K2/2Q5/B7 w - - 0 1", "g8=N#"],
    ["8/3NPQ2/2pk3B/8/8/8/4K2P/8 w - - 0 1", "e8=N#"],
  ],
  u1: [
    ["6k1/1PR2ppp/5p2/8/1K6/1n6/8/8 w - - 0 1", "b8=Q#"],
    ["5k2/3Pppp1/5p2/8/2n5/8/1R6/7K w - - 0 1", "d8=Q#"],
    ["1k6/ppp1P3/R4p2/8/8/4n3/7K/8 w - - 0 1", "e8=Q#"],
    ["5k2/P3ppp1/4R1p1/3n4/8/8/8/1K6 w - - 0 1", "a8=Q#"],
    ["2k5/1ppp2P1/1p6/8/8/6R1/n7/7K w - - 0 1", "g8=Q#"],
    ["4k2K/P2ppp1p/7n/8/8/4R3/8/8 w - - 0 1", "a8=Q#"],
    ["5k2/3Pppp1/8/2p4R/1n6/1K6/8/8 w - - 0 1", "d8=Q#"],
    ["2k5/1ppp3P/8/8/2K3Rp/8/8/n7 w - - 0 1", "h8=Q#"],
    ["3k4/2ppp2P/4R3/8/1K6/7p/8/6n1 w - - 0 1", "h8=Q#"],
    ["5k2/4pppP/1Rp5/8/8/8/8/n4K2 w - - 0 1", "h8=Q#"],
    ["1K3k2/2P1pppp/8/8/8/R7/8/7n w - - 0 1", "c8=Q#"],
    ["1K3k2/2P1ppp1/5R2/8/8/2p5/8/6n1 w - - 0 1", "c8=Q#"],
  ],
  m2: [
    ["2k5/8/3Qp3/1B6/4RK2/8/7n/1r6 w - - 0 1", "Ba6+"],
    ["3kB2R/5Q2/1p3n2/8/3r4/8/2K5/8 w - - 0 1", "Bc6+"],
    ["8/3K3B/k3n3/5R2/5Q2/8/3p4/6r1 w - - 0 1", "Qa4+"],
    ["1r3k2/8/2Q3K1/8/B1R2p2/8/8/n7 w - - 0 1", "Qd6+"],
    ["8/2k3p1/4Q3/8/rR4K1/1n5B/8/8 w - - 0 1", "Qe7+"],
    ["4r3/3Bk3/2R5/8/5p2/4n3/8/K6Q w - - 0 1", "Qh7+"],
    ["R7/3r4/1p2k3/6Q1/4B3/K7/8/4n3 w - - 0 1", "Re8+"],
    ["8/8/k7/1n6/4pB2/4r3/KR6/5Q2 w - - 0 1", "Qxb5+"],
    ["1B6/6k1/8/1n4K1/5p2/2R5/5r2/3Q4 w - - 0 1", "Qd7+"],
    ["8/6k1/n7/3R4/1r3Q2/p7/8/1B2K3 w - - 0 1", "Rg5+"],
    ["7k/8/5p2/7K/7R/5B2/4n3/r6Q w - - 0 1", "Kg6+"],
    ["8/1n4k1/6B1/7K/8/2R5/r5p1/Q7 w - - 0 1", "Rc7+"],
    ["k1K1R3/8/B4Q2/4n3/1p6/r7/8/8 w - - 0 1", "Kc7+"],
    ["4B2k/2K5/3Q4/1pnR4/r7/8/8/8 w - - 0 1", "Qh6+"],
    ["8/6k1/Q5B1/2R5/2p3K1/8/8/1r3n2 w - - 0 1", "Rc7+"],
    ["4k3/B7/1Q6/p7/r5R1/7K/8/3n4 w - - 0 1", "Qe6+"],
  ],
  m3: [
    ["k2n4/8/3R4/2K5/4p3/8/5Q2/8 w - - 0 1", "Rxd8+"],
    ["k7/8/8/6R1/8/3nK2Q/4p3/8 w - - 0 1", "Qc8+"],
    ["k7/1n6/5p2/8/8/3R4/5Q2/K7 w - - 0 1", "Qb6"],
    ["Q7/8/3k4/2p5/5Kn1/8/8/7R w - - 0 1", "Qa6+"],
    ["2k5/8/p7/8/K7/6R1/8/3Q1n2 w - - 0 1", "Rc3+"],
    ["R7/8/6k1/8/6K1/3n4/4p3/2Q5 w - - 0 1", "Qc6+"],
    ["3k4/5p2/8/4K3/n7/8/4Q1R1/8 w - - 0 1", "Kd6"],
    ["8/8/6k1/8/4R3/1Q5p/K7/n7 w - - 0 1", "Qf3"],
    ["6n1/8/5k2/1Q6/4K2p/8/8/6R1 w - - 0 1", "Qf5+"],
    ["6k1/1K6/1n6/8/p7/8/R7/3Q4 w - - 0 1", "Qf1"],
    ["8/8/n6k/3K2p1/6Q1/5R2/8/8 w - - 0 1", "Qe6+"],
    ["3k4/8/8/8/2p5/8/1R3K1n/Q7 w - - 0 1", "Qa7"],
    ["8/n2K4/1k6/4R3/Q1p5/8/8/8 w - - 0 1", "Qb4+"],
    ["n7/7K/5k2/8/8/2p5/6R1/1Q6 w - - 0 1", "Qe4"],
    ["2R1n3/1k6/8/8/3Q4/1p6/1K6/8 w - - 0 1", "Qc5"],
    ["6k1/8/1K6/R4p2/8/8/8/1Q4n1 w - - 0 1", "Qxf5"],
    ["2n3k1/8/8/8/QR6/2p5/8/2K5 w - - 0 1", "Qd7"],
    ["1k6/8/3R3Q/6n1/7p/8/4K3/8 w - - 0 1", "Rb6+"],
    ["5k2/2K5/8/2p5/8/n7/1Q6/1R6 w - - 0 1", "Rf1+"],
    ["5K2/8/6k1/5p2/3n4/2R5/1Q6/8 w - - 0 1", "Rg3+"],
    ["8/2p5/K5k1/8/Q4n1R/8/8/8 w - - 0 1", "Qxf4"],
    ["3Q4/8/6k1/8/8/2p4K/4R3/1n6 w - - 0 1", "Re6+"],
    ["8/5k2/1n5p/K7/1Q6/8/2R5/8 w - - 0 1", "Qxb6"],
    ["8/8/k7/7Q/8/2R5/1nK3p1/8 w - - 0 1", "Rc6+"],
    ["8/8/k4p2/8/8/1K4n1/2Q2R2/8 w - - 0 1", "Rxf6+"],
    ["3k4/p7/4Q1n1/8/1R6/8/8/4K3 w - - 0 1", "Rd4+"],
  ],
  m4: [
    ["1R6/3k4/R4p1K/8/8/8/8/8 w - - 0 1", "Rb7+"],
    ["8/5k2/8/4K3/1p6/1R6/1R6/8 w - - 0 1", "Rxb4"],
    ["3R4/2k1p3/8/8/4K3/8/8/6R1 w - - 0 1", "Rd2"],
    ["1K6/4k3/3p4/8/R7/7R/8/8 w - - 0 1", "Rh6"],
    ["4k3/K7/5p2/5R2/8/8/7R/8 w - - 0 1", "Rh7"],
    ["8/2R4R/k3K3/8/6p1/8/8/8 w - - 0 1", "Rb7"],
  ],
  s1: [
    ["k7/8/1p6/2Q5/3P4/7K/8/8 w - - 0 1", "Qxb6"],
    ["8/4p3/1K2k3/8/5Q2/7P/8/8 w - - 0 1", "Kc6"],
    ["8/1P1k1p2/5Q2/8/8/5K2/8/8 w - - 0 1", "b8=Q"],
    ["8/p7/k7/8/7Q/7K/4P3/8 w - - 0 1", "Qb4"],
    ["3k4/8/2Q2P2/8/8/3K4/3p4/8 w - - 0 1", "Kxd2"],
    ["8/7p/7k/8/2Q5/2P1K3/8/8 w - - 0 1", "Qg4"],
    ["k7/7Q/8/8/8/6P1/3p4/3K4 w - - 0 1", "Qc7"],
    ["8/2p5/k5K1/2Q5/2P5/8/8/8 w - - 0 1", "Qxc7"],
  ],
  mat: [
    ["5N2/8/3k2r1/8/8/8/8/3K4 w - - 0 1", "Nxg6"],
    ["3k4/8/8/3K4/N1r5/8/8/8 w - - 0 1", "Kxc4"],
    ["8/3k4/3r4/1N6/8/6K1/8/8 w - - 0 1", "Nxd6"],
    ["3r4/8/k1N5/2K5/8/8/8/8 w - - 0 1", "Nxd8"],
    ["1r6/5k2/N7/8/8/8/6K1/8 w - - 0 1", "Nxb8"],
    ["8/8/2k5/4r3/6N1/8/8/5K2 w - - 0 1", "Nxe5+"],
  ],
  rep: [
    ["2K1Q3/7k/4N2p/1p1r1b2/8/8/4n3/7q w - - 0 1", "Qf7+ Kh8 Qe8+ Kh7"],
    ["1n2K2k/8/6Q1/8/1r6/8/3p4/2q5 w - - 0 1", "Qh6+ Kg8 Qg6+ Kh8"],
    ["3b3k/5Q2/4p3/6BK/7p/8/q7/7n w - - 0 1", "Qf8+ Kh7 Qf7+ Kh8"],
    ["k3r3/3K4/1Q6/8/8/Bp4r1/8/8 w - - 0 1", "Qa6+ Kb8 Qb6+ Ka8"],
  ],};

/** 一关的题型 */
export type LevelKind = "mate" | "stalemate" | "material" | "fifty" | "repetition";

export interface LevelSpec {
  /** 0 基关号 */
  index: number;
  chapterIndex: number;
  indexInChapter: number;
  fen: string;
  kind: LevelKind;
  /** 杀棋题：几个半回合内强制将杀（1 = 一步杀，3 = 两步杀…） */
  plies: number;
  /** 参考解（SAN）。`require` 为真时这一手是硬性要求 */
  solution: string;
  /** 首着必须走参考解（易位课、过路兵课、升变课） */
  require: boolean;
  /** 三次重复题的主线（一个循环，实际要走两遍） */
  line: string[];
  title: string;
  hint: string;
  /** 防守方 AI 档位 */
  tier: AiTier;
}

interface Slot {
  fam: string;
  from: number;
  count: number;
  kind: LevelKind;
  plies: number;
  require: boolean;
  title: string;
  hint: string;
  tier: AiTier;
}

/**
 * 每一章由几段题目拼起来。段与段的顺序就是关卡顺序，
 * 每段的 `count` 加起来正好是这一章的 `size`。
 */
const PLAN: Slot[] = [
  // 第 1 章 · 兵的花园 24
  {
    fam: "p1",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 1,
    require: false,
    title: "兵到底线",
    hint: "把兵送到第 8 横线，选一个最合适的兵种升变，一步就够。",
    tier: 2,
  },
  {
    fam: "p2",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 3,
    require: false,
    title: "两步兵阵",
    hint: "先想清楚对方的王只能往哪儿走，再决定这一手动兵还是动王。",
    tier: 2,
  },
  // 第 2 章 · 车的走廊 24
  {
    fam: "r1",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 1,
    require: false,
    title: "底线走廊",
    hint: "对方的王被自己的兵挡在底线上，车照过去那条横线就收网了。",
    tier: 2,
  },
  {
    fam: "r2",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 3,
    require: false,
    title: "两车梯子",
    hint: "两个车轮流照，一层一层把对方的王往边上推。",
    tier: 2,
  },
  // 第 3 章 · 马的跳跃 24
  {
    fam: "n1",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 1,
    require: false,
    title: "马蹄落点",
    hint: "马能跳过挡路的子。找一个落点，让它照到对方的王，同时堵住退路。",
    tier: 2,
  },
  {
    fam: "n2",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 3,
    require: false,
    title: "马的叉击",
    hint: "先用马将军把对方的王逼到指定格，第二手再收网。",
    tier: 3,
  },
  // 第 4 章 · 象与后 24
  {
    fam: "b1",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 1,
    require: false,
    title: "斜线一击",
    hint: "象只走斜线，两个象配合起来能同时管住两种颜色的格子。",
    tier: 2,
  },
  {
    fam: "q2",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 3,
    require: false,
    title: "后与象合力",
    hint: "后负责贴身照，象在远处补住逃跑的斜线。",
    tier: 3,
  },
  // 第 5 章 · 易位课 22
  {
    fam: "c1",
    from: 0,
    count: 6,
    kind: "mate",
    plies: 1,
    require: true,
    title: "易位就是杀",
    hint: "王和车一起动：王往边上走两格，车跳到王刚跨过的那一格。这一关必须用易位收官。",
    tier: 2,
  },
  {
    fam: "c2",
    from: 0,
    count: 16,
    kind: "mate",
    plies: 3,
    require: true,
    title: "先易位再收网",
    hint: "先把王安置好、把车调到中路，第二手才是致命的那一下。这一关首着必须是易位。",
    tier: 3,
  },
  // 第 6 章 · 过路与升变 22
  {
    fam: "e1",
    from: 0,
    count: 8,
    kind: "mate",
    plies: 1,
    require: true,
    title: "吃过路兵",
    hint: "对方的兵刚冲过两格，你的兵可以斜着走到它跨过的那一格把它请走——只有这一手能吃。",
    tier: 2,
  },
  {
    fam: "e2",
    from: 0,
    count: 6,
    kind: "mate",
    plies: 3,
    require: true,
    title: "过路兵开局",
    hint: "先吃过路兵打开线路，第二手才收网。错过这一手，那条线就再也打不开了。",
    tier: 3,
  },
  {
    fam: "un",
    from: 0,
    count: 5,
    kind: "mate",
    plies: 1,
    require: true,
    title: "升变不一定选后",
    hint: "升成后反而不是杀。想想哪个兵种正好能照到对方的王。",
    tier: 2,
  },
  {
    fam: "u1",
    from: 0,
    count: 3,
    kind: "mate",
    plies: 1,
    require: true,
    title: "升后收官",
    hint: "兵走到底线必须升变，这一关升成后就是杀。",
    tier: 2,
  },
  // 第 7 章 · 将杀练习 24
  {
    fam: "m2",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 3,
    require: false,
    title: "两步杀",
    hint: "第一手要让对方的每一种应招都通向同一个结局。",
    tier: 3,
  },
  {
    fam: "m3",
    from: 0,
    count: 12,
    kind: "mate",
    plies: 5,
    require: false,
    title: "三步杀",
    hint: "先把对方的王赶到边线，再把网收到只剩一格。",
    tier: 3,
  },
  // 第 8 章 · 花园杯 24
  {
    fam: "m3",
    from: 12,
    count: 6,
    kind: "mate",
    plies: 5,
    require: false,
    title: "残局三步杀",
    hint: "残局里王也是进攻的子，别把它留在原地。",
    tier: 3,
  },
  {
    fam: "m4",
    from: 0,
    count: 6,
    kind: "mate",
    plies: 7,
    require: false,
    title: "四步梯子杀",
    hint: "两个车轮流照，一层一层把对方的王逼到最边上，四手之内收网。",
    tier: 3,
  },
  {
    fam: "s1",
    from: 0,
    count: 5,
    kind: "stalemate",
    plies: 0,
    require: true,
    title: "逼和一手",
    hint: "这一关反过来：找一步棋，让对方一步都走不了，又没有被将——那就是逼和，算和棋。",
    tier: 2,
  },
  {
    fam: "mat",
    from: 0,
    count: 4,
    kind: "material",
    plies: 0,
    require: true,
    title: "子力不足和",
    hint: "把对方最后一个能将杀的子请去休息，剩下的棋子谁也杀不掉谁，直接判和。",
    tier: 2,
  },
  {
    fam: "rep",
    from: 0,
    count: 2,
    kind: "repetition",
    plies: 0,
    require: true,
    title: "三次重复和",
    hint: "对方的王每次只有一条退路。照着同一个循环连将两遍，同一个局面出现三次就是和棋。",
    tier: 3,
  },
  {
    fam: "fifty",
    from: 0,
    count: 1,
    kind: "fifty",
    plies: 0,
    require: true,
    title: "50 回合和",
    hint: "已经连着 50 个回合没吃子也没动兵了。再走一步安全的棋（别吃子、别动兵），和棋就成立。",
    tier: 2,
  },
];

/** 50 回合题只有一道，单独放：白方剩一王一马，走一步安静的棋就把和棋定下来 */
const FIFTY: Array<readonly [string, string]> = [["8/8/8/3k4/8/8/2q5/K6N w - - 99 80", "Nf2"]];

const ALL_FAM: Record<string, Array<readonly [string, string]>> = { ...FAM, fifty: FIFTY };

function buildAll(): LevelSpec[] {
  const out: LevelSpec[] = [];
  let chapterIndex = 0;
  let usedInChapter = 0;
  for (const slot of PLAN) {
    const pool = ALL_FAM[slot.fam];
    for (let i = 0; i < slot.count; i++) {
      const raw = pool[slot.from + i];
      const index = out.length;
      out.push({
        index,
        chapterIndex,
        indexInChapter: usedInChapter,
        fen: raw[0],
        kind: slot.kind,
        plies: slot.plies,
        solution: slot.kind === "repetition" ? raw[1].split(" ")[0] : raw[1],
        require: slot.require,
        line: slot.kind === "repetition" ? raw[1].split(" ") : [],
        title: slot.title,
        hint: slot.hint,
        tier: slot.tier,
      });
      usedInChapter++;
      if (usedInChapter >= CHAPTERS[chapterIndex].size) {
        chapterIndex++;
        usedInChapter = 0;
      }
    }
  }
  return out;
}

/** 全部 188 关（模块加载时拼一次，纯数据） */
export const LEVELS: LevelSpec[] = buildAll();

/** 取第 index 关（0 基）；越界按最后一关兜底，绝不返回 undefined */
export function buildLevel(index: number): LevelSpec {
  const i = Math.max(0, Math.min(LEVELS.length - 1, Math.round(index)));
  return LEVELS[i];
}

/** 无尽模式对手的最高档；第 10 局起就一直是这一档，不会再往上 */
export const ENDLESS_TOP_TIER: AiTier = 4;

/** 无尽模式第 round 局的对手档位与起手局面（越往后越难） */
export function endlessTier(round: number): AiTier {
  if (round <= 2) return 1;
  if (round <= 5) return 2;
  if (round <= 9) return 3;
  return ENDLESS_TOP_TIER;
}

/** 对手是不是已经到最高档：到顶之后再连胜也不会更难，界面上要说清楚 */
export function endlessAtTop(round: number): boolean {
  return endlessTier(round) >= ENDLESS_TOP_TIER && endlessThinkMs(round) >= ENDLESS_TOP_THINK_MS;
}

/**
 * 无尽模式的题面池：用的是题库里没排进 188 关的那些局面，
 * 每一个都和闯关题同一批生成、同样验证过，白方都有强制赢法。
 *
 * 后半段（`p2` / `c2` / `e1` / `un` 的余料）是第 2 轮补进来的：
 * 对手档位第 10 局就封顶了，题面至少得多换几轮才不至于原地打转。
 * 这几道也都是 3 半回合以内的强制杀，和前面一批同一个难度量级，
 * 不改 `endlessTier` / `endlessThinkMs`，所以难度标定没动。
 * `levels.test.ts` 会逐个用搜索证明「白方真有强制杀」。
 */
const ENDLESS_POOL: Array<readonly [string, string]> = [
  ...FAM.m2.slice(12),
  ...FAM.m3.slice(18),
  ...FAM.q2.slice(12),
  ...FAM.n2.slice(12),
  ...FAM.r2.slice(12),
  ...FAM.p1.slice(12),
  ...FAM.u1.slice(3),
  ...FAM.p2.slice(12),
  ...FAM.c2.slice(16),
  ...FAM.e1.slice(8),
  ...FAM.un.slice(5),
];

/** 无尽模式第 round 局（1 起）的起手局面 */
export function endlessStart(round: number): string {
  const i = (Math.max(1, Math.round(round)) - 1) % ENDLESS_POOL.length;
  return ENDLESS_POOL[i][0];
}

/** 无尽模式一共准备了几个不同的残局 */
export const ENDLESS_COUNT = ENDLESS_POOL.length;

/** 第 round 局用的是题面池的第几轮（1 起）：一轮跑完就从头再来一遍 */
export function endlessLap(round: number): number {
  return Math.floor((Math.max(1, Math.round(round)) - 1) / ENDLESS_POOL.length) + 1;
}

/** 对手思考时间的上限（毫秒）；到顶之后再连胜也不会想得更久 */
export const ENDLESS_TOP_THINK_MS = 240;

/** 无尽模式第 round 局对手的思考时间上限（毫秒），越往后想得越久 */
export function endlessThinkMs(round: number): number {
  return Math.min(ENDLESS_TOP_THINK_MS, 40 + round * 20);
}

/** 过关评星：一次做对 3 星，错一次 2 星，再多就 1 星 */
export function rateLevel(mistakes: number): 1 | 2 | 3 {
  if (mistakes <= 0) return 3;
  if (mistakes === 1) return 2;
  return 1;
}

/** 过关的夸奖语 */
export function winLine(spec: LevelSpec, mistakes: number): string {
  if (spec.kind !== "mate") return "和棋也是一种胜利——你把这一局稳稳收住了。";
  if (mistakes === 0) return "一手不差，这道题被你看穿啦！";
  return "找到啦！刚才那几步试探也是有用的思考。";
}

/** 失败只鼓励，不批评 */
export function loseLine(spec: LevelSpec): string {
  if (spec.kind === "mate") return "这一手之后就没有强制杀了，把棋子放回去，换个顺序再看看。";
  return "这一步还没走成，回到题面重新摆一遍，答案就在附近。";
}
