// 残局闯关 188 课 —— 章节、题面与讲解。
//
// 局面数据在 `endgames.data.ts`（自动生成 + 逐课验过），这个文件负责：
//   · 把紧凑串解析成棋盘；
//   · 把 188 课切成 8 章（章节大小之和恒等于 188）；
//   · 给每一课配一句**不剧透坐标**的题面与提示。
import {
  type Board,
  type PieceType,
  type Side,
  PIECE_NAME,
  idx,
  makeEmptyBoard,
} from "./logic";
import type { Chapter } from "../level99";
import { RAW } from "./endgames.data";

export interface Endgame {
  /** 0 基课号，与 188 关框架的 level 一一对应 */
  level: number;
  /** 紧凑局面串 */
  setup: string;
  /** 红方几步之内必胜 */
  mateIn: number;
  /** 收官方式：将死还是困毙 */
  finish: "checkmate" | "stalemate";
  /** 首着动的是哪个兵种（提示只说这个，不说坐标） */
  lead: PieceType;
  /** 第几章（0 基） */
  chapter: number;
}

/** 把 `rK4,9 bK4,0` 这样的串摆成棋盘 */
export function parseSetup(setup: string): Board {
  const board = makeEmptyBoard();
  for (const token of setup.trim().split(/\s+/)) {
    if (!token) continue;
    const side: Side = token[0] === "r" ? "red" : "black";
    const type = token[1] as PieceType;
    const [x, y] = token.slice(2).split(",").map((n) => Number(n));
    board[idx(x, y)] = { side, type };
  }
  return board;
}

export const PUZZLES: Endgame[] = RAW.map((r, i) => ({
  level: i,
  setup: r.s,
  mateIn: r.n,
  finish: r.f === "s" ? "stalemate" : "checkmate",
  lead: r.l as PieceType,
  chapter: r.c,
}));

/** 第 level 课（越界 clamp） */
export function puzzleAt(level: number): Endgame {
  const n = Number.isFinite(level) ? Math.round(level) : 0;
  return PUZZLES[Math.max(0, Math.min(PUZZLES.length - 1, n))];
}

export function puzzleBoard(p: Endgame): Board {
  return parseSetup(p.setup);
}

/* ------------------------------------------------------------------ */
/* 章节                                                                */
/* ------------------------------------------------------------------ */

export interface ThemeDef {
  name: string;
  emoji: string;
  color: string;
  desc: string;
  /** 这一章统一的讲法，出现在题面里 */
  lesson: string;
}

/**
 * 8 章残局，全部用中文原创说法命名 —— 不甩生僻术语，但讲的确实是那些杀法：
 * 一车定杀、炮马冷着、两步收官、困毙、马炮配合、双车错、兵渡河立功、别把胜势走成和棋。
 */
export const THEMES: ThemeDef[] = [
  {
    name: "一车封路",
    emoji: "🚗",
    color: "#FFE0C2",
    desc: "只用一只车，也能把对方的将逼到没地方走。先学会数将的退路。",
    lesson: "把将能去的每一个交叉点数一遍，只剩最后一个的时候，那里就是你要占的地方。",
  },
  {
    name: "一招定音",
    emoji: "🎯",
    color: "#FFD9E8",
    desc: "炮要炮架，马要马位。这一章的每一课都只差一步，看你找不找得到。",
    lesson: "炮的力量在炮架后面，马的力量在它落脚的那一格：先想清楚落点，再动手。",
  },
  {
    name: "两步收官",
    emoji: "🧭",
    color: "#D9E6FF",
    desc: "第一步不吃子也不将军，只是把门关上；第二步才收官。",
    lesson: "两步杀的第一步常常是「安静」的一步：它堵住的是对方逃跑的方向。",
  },
  {
    name: "围而不将",
    emoji: "🕸️",
    color: "#E4D9FF",
    desc: "不将军也能赢：对方一步棋都走不出来，这叫困毙，同样算你赢，不是出错。",
    lesson: "困毙要数的是对方**所有**子的走法，只要还有一个能动，就还没成。",
  },
  {
    name: "马炮同心",
    emoji: "🐎",
    color: "#D9F2C4",
    desc: "马负责把路堵死，炮负责隔着子打过去，两个子配合起来比一只车还厉害。",
    lesson: "马炮配合的关键是先摆好马位，再让炮找到那个炮架。",
  },
  {
    name: "双车并进",
    emoji: "🚙",
    color: "#CDE6FF",
    desc: "两只车一横一竖，一只逼、一只守，对方的将会被一层层挤到角落里。",
    lesson: "两只车不要挤在同一条线上，让它们分别管住一横一竖，网才收得住。",
  },
  {
    name: "小兵立功",
    emoji: "🌾",
    color: "#FFF0C2",
    desc: "过了河的兵能横着走，贴到九宫门口时，最后一击常常就是它。",
    lesson: "兵只能往前和左右，走出去就收不回来：落点一定要想好再走。",
  },
  {
    name: "别走成和棋",
    emoji: "🌈",
    color: "#FFE9F1",
    desc: "这一章只有一条路能赢，别的走法都会把好局面拖成和棋。慢一点想。",
    lesson: "手里有优势的时候更要算清楚：先问「走完这一步，对方还有几种应法」。",
  },
];

/** 188 关框架要的章节表（大小之和恒等于 188） */
export const CHAPTERS: Chapter[] = THEMES.map((t, i) => ({
  name: t.name,
  emoji: t.emoji,
  color: t.color,
  desc: t.desc,
  size: PUZZLES.filter((p) => p.chapter === i).length,
}));

/* ------------------------------------------------------------------ */
/* 题面与提示                                                          */
/* ------------------------------------------------------------------ */

/** 本课的目标（写在棋盘上方，说清楚步数与收官方式） */
export function goalText(p: Endgame): string {
  if (p.finish === "stalemate") {
    return `红方先走，${p.mateIn} 步之内让黑方一步棋都走不了（困毙）`;
  }
  return `红方先走，${p.mateIn} 步之内将死黑将`;
}

/** 题面小标题：「第 12 课 · 一车封路 · 一步杀」 */
export function headline(p: Endgame): string {
  const th = THEMES[p.chapter];
  const kind = p.finish === "stalemate" ? "困毙" : `${p.mateIn === 1 ? "一" : p.mateIn === 2 ? "两" : "三"}步杀`;
  return `${th.emoji} 第 ${p.level + 1} 课 · ${th.name} · ${kind}`;
}

/** 开局提示：只说思路，不说坐标 */
export function openingTip(p: Endgame): string {
  return `${THEMES[p.chapter].lesson}（${goalText(p)}）`;
}

/**
 * 用掉一次提示之后给的话：只告诉你**该动哪个子**，落点自己找。
 * 这样既帮得上忙，又不至于把答案直接抄给孩子。
 */
export function hintText(p: Endgame): string {
  const name = PIECE_NAME.red[p.lead];
  if (p.lead === "K") {
    return `试试动一下自己的帅 —— 将帅不能照面，这条规矩也能拿来当武器。`;
  }
  return `第一步该动的是${name}。想清楚它落到哪里，黑将就没路可走了。`;
}

/** 通关话术（不用提示解开才是三星） */
export function solvedText(p: Endgame, hintUsed: boolean): string {
  if (hintUsed) return "解开啦！下次不用提示，再来一遍就是三星。";
  if (p.finish === "stalemate") return "困毙成功！不将军也能赢，这一手很漂亮。";
  return `${p.mateIn} 步之内收官，一步都没有多走 —— 这就是这一章要练的本事。`;
}

/** 没解开时的鼓励（只鼓励，不批评） */
export function failText(p: Endgame): string {
  return `步数用完啦。回想一下：黑将现在能去哪几个点？${THEMES[p.chapter].lesson}`;
}

/**
 * 星级：一次就解开（没用提示）3 星，用过提示 2 星，
 * 重摆三次以上才解开给 1 星 —— 反复试也照样过关，只是星星少一点。
 */
export function starsFor(hintUsed: boolean, retries: number): 1 | 2 | 3 {
  if (retries >= 3) return 1;
  return hintUsed ? 2 : 3;
}
