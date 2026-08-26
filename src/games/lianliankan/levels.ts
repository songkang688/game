/**
 * 连连看 · 188 关关卡表。
 * 前 99 关是 1.0 的六大场馆，生成参数一个字都没动；
 * 1.1 在末尾追加四座新场馆（第 100–188 关）：
 *  ⑦风车旋转馆=整块棋盘会转 90°  ⑧一拐直通道=连线只准拐一次弯
 *  ⑨伪装迷影阁=图案会戴上面具    ⑩四方重力场=上下左右四种重力轮着来
 * 1.0 的六个主题章节，各有专属图案与玩法（并非同一模板）：
 *  ①果园入门=经典静止棋盘  ②萌宠动物园=棋盘更大
 *  ③玩具馆=消一对就下落  ④海洋馆=消一对向左滑
 *  ⑤星光夜市=时间紧+洗牌少  ⑥彩虹广场=大棋盘+重力混合
 */
import type { Chapter } from "../level99";

/** 1.1 新增 "up" 与 "right" 两个方向 */
export type Gravity = "none" | "down" | "left" | "up" | "right";

/** 1.0 的六大场馆：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新场馆从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export interface LlkLevel {
  rows: number;
  cols: number;
  kinds: number;
  seconds: number;
  shuffles: number;
  gravity: Gravity;
  /** 用第几套主题图案 */
  theme: number;
  /** 1.1 连线最多拐几次弯（不写按 1.0 的 2 次算），前 99 关不带 */
  maxTurns?: number;
  /** 1.1 棋盘整体旋转 90° 的间隔毫秒，前 99 关不带 */
  rotateMs?: number;
  /** 1.1 戴面具的图案占比（0..1），前 99 关不带 */
  disguise?: number;
  /** 1.1 换一批面具的间隔毫秒，前 99 关不带 */
  disguiseMs?: number;
  /**
   * 1.1 连不动时的自动重排不计入洗牌次数：新场馆的规则更花，
   * 靠它保证棋盘永远走得下去，输赢只由时间决定。前 99 关不带。
   */
  autoShuffleFree?: boolean;
}

export const CHAPTERS: Chapter[] = [
  { name: "果园入门", emoji: "🍎", color: "#FFE9DD", desc: "两个一样的图案，拐弯不超过两次就能连！", size: 17 },
  { name: "萌宠动物园", emoji: "🐻", color: "#FFF3CE", desc: "棋盘变大了，小动物等你来连！", size: 17 },
  { name: "玩具馆", emoji: "🧸", color: "#EBDDFB", desc: "新玩法：消掉一对，上面的玩具会掉下来！", size: 17 },
  { name: "海洋馆", emoji: "🐠", color: "#D6F0FF", desc: "新玩法：消掉一对，右边的鱼儿向左游！", size: 16 },
  { name: "星光夜市", emoji: "🌟", color: "#FFE0EC", desc: "时间更紧、洗牌更少，考验眼力！", size: 16 },
  { name: "彩虹广场", emoji: "🌈", color: "#E2F7DF", desc: "大棋盘加重力变化，终极连连挑战！", size: 16 },
  // ↓ 1.1 追加：四座新场馆，合计 89 关
  { name: "风车旋转馆", emoji: "🌀", color: "#E6F1FF", desc: "风一吹整块棋盘就转 90°，位置全变、图案还在！", size: 23 },
  { name: "一拐直通道", emoji: "📏", color: "#FFF0DC", desc: "这里的线最多只准拐一次弯，先看直路再动手。", size: 22 },
  { name: "伪装迷影阁", emoji: "🎭", color: "#EFE4FF", desc: "有些图案会戴上面具，点一下才露出真面目。", size: 22 },
  { name: "四方重力场", emoji: "🧲", color: "#DDF3EC", desc: "上下左右四种重力轮着来，消完往哪靠要先想好。", size: 22 }
];

export const THEME_EMOJIS: string[][] = [
  ["🍎", "🍌", "🍇", "🍓", "🍑", "🍍", "🥝", "🍉", "🍒", "🍋", "🍊", "🫐", "🍈", "🥭"],
  ["🐱", "🐶", "🦊", "🐰", "🐼", "🐨", "🦁", "🐸", "🐥", "🐷", "🐭", "🐻", "🐹", "🦉"],
  ["🧸", "🪀", "🎈", "🎁", "🪁", "🎠", "🥁", "🎺", "🦖", "🎲", "🚂", "🪆", "🎪", "🎨"],
  ["🐠", "🐙", "🦀", "🐬", "🐳", "🦞", "🐚", "🐡", "🦈", "🐢", "🦐", "🪸", "🐟", "🦑"],
  ["🌟", "🌙", "🎇", "🏮", "🍭", "🍡", "🧋", "🍿", "🎡", "🎢", "🌃", "🎑", "🍧", "🥠"],
  ["🌈", "🌸", "⭐", "🚗", "🎈", "🦄", "🍀", "🌻", "🦋", "🐞", "🍄", "🌼", "☂️", "🎀"],
  // ↓ 1.1 四套新图案
  ["🌀", "💨", "🍃", "🎐", "⛵", "🪂", "🌪️", "🎏", "🛞", "🪃", "🕰️", "🌬️", "🍁", "🪶"],
  ["📏", "📐", "🧭", "🚦", "🛤️", "🔧", "🪛", "🧱", "🚧", "🔦", "🗝️", "🧲", "📎", "🪜"],
  ["🎭", "🃏", "🕯️", "🪞", "🔮", "👻", "🦇", "🕸️", "🪄", "🪩", "🧿", "🗿", "🕳️", "🎴"],
  ["🪐", "☄️", "🛰️", "🚀", "🌌", "💫", "🌠", "🔭", "👾", "🛸", "🌑", "⚛️", "🧊", "🌗"]
];

function buildLevel(ci: number, t: number): LlkLevel {
  switch (ci) {
    case 0:
      return {
        rows: 4, cols: t < 8 ? 4 : 6,
        kinds: 6 + Math.floor(t / 4),
        seconds: 90 + Math.floor(t / 4) * 10,
        shuffles: 3, gravity: "none", theme: 0
      };
    case 1:
      return {
        rows: 5 + Math.floor(t / 9), cols: 6,
        kinds: 8 + Math.floor(t / 4),
        seconds: 130 + Math.floor(t / 3) * 10,
        shuffles: 3, gravity: "none", theme: 1
      };
    case 2:
      return {
        rows: 5 + Math.floor(t / 9), cols: 6,
        kinds: 8 + Math.floor(t / 4),
        seconds: 150 + Math.floor(t / 3) * 10,
        shuffles: 3, gravity: "down", theme: 2
      };
    case 3:
      return {
        rows: 6, cols: 6 + (t >= 10 ? 2 : 0),
        kinds: 9 + Math.floor(t / 4),
        seconds: 160 + Math.floor(t / 3) * 10,
        shuffles: 3, gravity: "left", theme: 3
      };
    case 4:
      return {
        rows: 6, cols: 8,
        kinds: 10 + Math.floor(t / 4),
        seconds: 150 + Math.floor(t / 4) * 10,
        shuffles: 2, gravity: "none", theme: 4
      };
    case 5: {
      const gravity: Gravity = t % 3 === 0 ? "none" : t % 3 === 1 ? "down" : "left";
      return {
        rows: 6 + Math.floor(t / 8), cols: 8,
        kinds: 12 + Math.floor(t / 6),
        seconds: 180 + Math.floor(t / 3) * 10,
        shuffles: 2, gravity, theme: 5
      };
    }
    case 6: {
      // 风车旋转馆：正方形棋盘才转得起来，转得越来越勤
      const n = t < 12 ? 6 : 8;
      return {
        rows: n, cols: n,
        kinds: Math.min(14, 8 + Math.floor(t / 3)),
        seconds: 170 + Math.floor(t / 3) * 10,
        shuffles: 3, gravity: "none", theme: 6,
        maxTurns: 2,
        rotateMs: 13000 - t * 300,
        autoShuffleFree: true
      };
    }
    case 7:
      // 一拐直通道：整章只准拐一次弯，连不动会自动重排，不会把人堵死
      return {
        rows: 5 + Math.floor(t / 11), cols: 6,
        kinds: Math.min(14, 8 + Math.floor(t / 4)),
        seconds: 180 + Math.floor(t / 3) * 10,
        shuffles: 4, gravity: t < 11 ? "none" : "down", theme: 7,
        maxTurns: 1,
        autoShuffleFree: true
      };
    case 8:
      // 伪装迷影阁：面具越来越多、换得越来越快
      return {
        rows: 5 + Math.floor(t / 11), cols: 6,
        kinds: Math.min(14, 9 + Math.floor(t / 4)),
        seconds: 190 + Math.floor(t / 3) * 10,
        shuffles: 3, gravity: t < 12 ? "none" : "left", theme: 8,
        maxTurns: 2,
        disguise: 0.2 + t * 0.008,
        disguiseMs: 9000 - t * 200,
        autoShuffleFree: true
      };
    default: {
      // 四方重力场：四种重力轮着来，末段把面具和一拐规则也请回来
      const gravity: Gravity = (["up", "right", "down", "left"] as const)[t % 4];
      return {
        rows: 6, cols: 8,
        kinds: Math.min(14, 10 + Math.floor(t / 4)),
        seconds: 200 + Math.floor(t / 3) * 10,
        shuffles: 4, gravity, theme: 9,
        maxTurns: t >= 18 ? 1 : 2,
        disguise: t >= 10 ? 0.18 + (t - 10) * 0.01 : undefined,
        disguiseMs: t >= 10 ? 8000 - (t - 10) * 200 : undefined,
        autoShuffleFree: true
      };
    }
  }
}

export const LEVELS: LlkLevel[] = (() => {
  const out: LlkLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();

/** 本关连线最多能拐几次弯（1.0 的关一律 2 次） */
export function turnsOf(level: LlkLevel): number {
  return level.maxTurns ?? 2;
}

/** 本关的棋盘种子：同一关每次进入的初始牌面一致 */
export function boardSeed(level: number): number {
  return level * 9176 + 331;
}
