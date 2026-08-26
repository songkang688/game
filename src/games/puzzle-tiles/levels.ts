/**
 * 拼图乐园 · 188 关关卡表。
 * 前 99 关是 1.0 的六大画册，生成参数一个字都没动；
 * 1.1 在末尾追加四本新画册（第 100–188 关）：
 *  ⑦巨幅长卷=5×5 大画板  ⑧旋转风车园=不推格子，点一下转 90°
 *  ⑨缺块补齐=从托盘里挑对的块补回画里  ⑩限时大画展=沙漏 + 最大 6×6
 * 1.0 的六个主题画册、四种拼图板式（并非同一模板）：
 *  ①花园画册=3×3 入门  ②动物画册=3×3 打乱更狠
 *  ③交通画册=4×3 长条拼图  ④水果派对=记忆拼图（看一眼就藏起来）
 *  ⑤星空画册=4×4 大拼图  ⑥彩虹大画展=大板+记忆混合终极挑战
 */
import { mulberry32, randInt, shuffled, type Chapter } from "../level99";

/** 1.0 的六本画册：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新画册从这里开始往后排） */
export const LEGACY_LEVELS = 99;

/** 1.1 新玩法：不填就是 1.0 的推格子拼图 */
export type PuzzleMode = "rotate" | "fill";

export interface PuzzleLevel {
  rows: number;
  cols: number;
  shuffleSteps: number;
  moveLimit: number;
  hints: number;
  /** 记忆模式：完整图案只在开局展示几秒 */
  hidePreview: boolean;
  theme: number;
  /** 步数 ≤ three 得 3 星，≤ two 得 2 星 */
  three: number;
  two: number;
  /** 1.1 玩法：旋转块 / 缺块补齐；不填就是推格子，前 99 关不带 */
  mode?: PuzzleMode;
  /** 1.1 限时拼：本关的沙漏秒数，前 99 关不带 */
  timeLimit?: number;
  /** 1.1 缺块补齐：画里缺几块，前 99 关不带 */
  missing?: number;
  /** 1.1 缺块补齐：托盘里多放几块干扰的，前 99 关不带 */
  extraPieces?: number;
  /** 1.1 旋转块：开局有几块是歪的，前 99 关不带 */
  rotateWrong?: number;
  /** 1.1 旋转块 / 缺块补齐的确定性种子，前 99 关不带 */
  seed?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "花园画册", emoji: "🌸", color: "#FFE3F1", desc: "把花园图案推回原位！", size: 17 },
  { name: "动物画册", emoji: "🐱", color: "#FFE9D6", desc: "小动物们被打乱得更厉害啦！", size: 17 },
  { name: "交通画册", emoji: "🚗", color: "#D6EBFF", desc: "4×3 长条拼图，格子更多啦！", size: 17 },
  { name: "水果派对", emoji: "🍓", color: "#FFE0E0", desc: "记忆拼图：完整图案只给你看一小会儿！", size: 16 },
  { name: "星空画册", emoji: "🌟", color: "#E6E0FF", desc: "4×4 大拼图，星空等你复原！", size: 16 },
  { name: "彩虹大画展", emoji: "🌈", color: "#E2F7DF", desc: "大拼图+记忆模式，终极画展！", size: 16 },
  // ↓ 1.1 追加：四本新画册，合计 89 关
  { name: "巨幅长卷", emoji: "🖼️", color: "#FFEFD6", desc: "5×5 的山水长卷，二十四块拼图等你推回原位！", size: 23 },
  { name: "旋转风车园", emoji: "🌪️", color: "#DDEFFA", desc: "这里不推格子：点一下转九十度，把每块都转正！", size: 22 },
  { name: "缺块补齐", emoji: "🧩", color: "#E4F3D9", desc: "画里缺了几块，从托盘里挑出对的那块补回去！", size: 22 },
  { name: "限时大画展", emoji: "⏳", color: "#F1E2FA", desc: "沙漏一直在走，画板越来越大，最后是六乘六的巨幅！", size: 22 }
];

type Tile = { emoji: string; bg: string };

/** 1.0 的六套主题素材：一块都不动 */
const LEGACY_THEME_TILES: Tile[][] = [
  [
    { emoji: "🌸", bg: "#FFD9E8" }, { emoji: "🌞", bg: "#FFF1BD" }, { emoji: "🌈", bg: "#D9F1FF" },
    { emoji: "🍎", bg: "#FFDCD2" }, { emoji: "🐝", bg: "#FDF3C7" }, { emoji: "🍀", bg: "#D9F5D3" },
    { emoji: "⛵", bg: "#D5EAFB" }, { emoji: "🎈", bg: "#F3DBFF" }, { emoji: "🌷", bg: "#FFDDF0" },
    { emoji: "🦋", bg: "#DCEFFF" }, { emoji: "🍄", bg: "#FFE4DA" }, { emoji: "🌻", bg: "#FFF4C2" },
    { emoji: "🐞", bg: "#FFDBDB" }, { emoji: "🌿", bg: "#DDF3D5" }, { emoji: "💧", bg: "#D8EFFB" }
  ],
  [
    { emoji: "🐱", bg: "#FFE8CE" }, { emoji: "🐶", bg: "#EDE1D1" }, { emoji: "🐰", bg: "#FFE3EE" },
    { emoji: "🦊", bg: "#FFD9BE" }, { emoji: "🐼", bg: "#E8E8E8" }, { emoji: "🐸", bg: "#DDF5D0" },
    { emoji: "🐥", bg: "#FFF6C4" }, { emoji: "🐙", bg: "#F4DBF0" }, { emoji: "🐨", bg: "#E3E9EE" },
    { emoji: "🦁", bg: "#FFE8B8" }, { emoji: "🐹", bg: "#FFE9D9" }, { emoji: "🐢", bg: "#DDEED2" },
    { emoji: "🦉", bg: "#E8DFD2" }, { emoji: "🐷", bg: "#FFE0E8" }, { emoji: "🦄", bg: "#F3E3FA" }
  ],
  [
    { emoji: "🚗", bg: "#FFDBDB" }, { emoji: "🚌", bg: "#FFF0C0" }, { emoji: "🚀", bg: "#E1E7FF" },
    { emoji: "🚁", bg: "#D8F2F8" }, { emoji: "🚂", bg: "#E6DCCB" }, { emoji: "⛵", bg: "#D5EAFB" },
    { emoji: "🚲", bg: "#E0F5DC" }, { emoji: "🛸", bg: "#EFE0FA" }, { emoji: "🚜", bg: "#E8EED2" },
    { emoji: "🚒", bg: "#FFDCD2" }, { emoji: "🚕", bg: "#FFF3C2" }, { emoji: "🛶", bg: "#DDEFF5" },
    { emoji: "🚠", bg: "#E4E8F5" }, { emoji: "🛴", bg: "#E2F2E4" }, { emoji: "🚤", bg: "#D8EDF8" }
  ],
  [
    { emoji: "🍓", bg: "#FFDDE4" }, { emoji: "🍌", bg: "#FFF6BF" }, { emoji: "🍇", bg: "#EBDCF8" },
    { emoji: "🍉", bg: "#FFE0DA" }, { emoji: "🍑", bg: "#FFE9D4" }, { emoji: "🍍", bg: "#FBF0C0" },
    { emoji: "🥝", bg: "#E1F3D2" }, { emoji: "🍒", bg: "#FFD9DE" }, { emoji: "🍊", bg: "#FFE7C8" },
    { emoji: "🍋", bg: "#FDF7C0" }, { emoji: "🫐", bg: "#E0E4F8" }, { emoji: "🍈", bg: "#E8F3D8" },
    { emoji: "🥭", bg: "#FFEBC4" }, { emoji: "🍐", bg: "#EAF3D0" }, { emoji: "🍅", bg: "#FFE0D6" }
  ],
  [
    { emoji: "🌟", bg: "#FFF3C4" }, { emoji: "🌙", bg: "#DCE9FF" }, { emoji: "☀️", bg: "#FFEDB8" },
    { emoji: "☁️", bg: "#EAF2FA" }, { emoji: "🌍", bg: "#D8EFDC" }, { emoji: "⚡", bg: "#FFF2C8" },
    { emoji: "❄️", bg: "#E0F3FF" }, { emoji: "🌋", bg: "#FFDFD0" }, { emoji: "🪐", bg: "#EFE3D2" },
    { emoji: "☄️", bg: "#FFE6CC" }, { emoji: "🌊", bg: "#D5ECFA" }, { emoji: "🌪️", bg: "#E5E9EE" },
    { emoji: "🌠", bg: "#E3E0F8" }, { emoji: "🌫️", bg: "#EAEEF2" }, { emoji: "🌌", bg: "#DCD8F0" }
  ],
  [
    { emoji: "🌈", bg: "#E7F5E4" }, { emoji: "🎨", bg: "#FFE9F0" }, { emoji: "🎪", bg: "#FFE4DA" },
    { emoji: "🎡", bg: "#E0EEFA" }, { emoji: "🎠", bg: "#F5E3F5" }, { emoji: "🎢", bg: "#E2F0E0" },
    { emoji: "🎁", bg: "#FFE1E8" }, { emoji: "🎀", bg: "#FFDDEE" }, { emoji: "🧁", bg: "#FBEBD8" },
    { emoji: "🍭", bg: "#F3E1F8" }, { emoji: "🎂", bg: "#FFE9DC" }, { emoji: "🪅", bg: "#EAE4F8" },
    { emoji: "🎊", bg: "#F8F0D8" }, { emoji: "🎉", bg: "#FFE6D2" }, { emoji: "🥳", bg: "#FFF0C8" }
  ]
];

/** 1.1 新画册每套的素材块数：够 6×6（35 块）用，还能剩几块当托盘干扰 */
export const NEW_POOL_SIZE = 36;

function makePool(emojis: string[], palette: string[]): Tile[] {
  return emojis.map((emoji, i) => ({ emoji, bg: palette[i % palette.length] }));
}

const SCROLL_POOL = makePool(
  ["🏔️", "🌊", "🌲", "🍃", "🪨", "🌤️", "🌉", "⛰️", "🏞️", "🌾", "🪵", "🦌",
    "🐟", "🦢", "🕊️", "🌰", "🍂", "🌱", "🪷", "🐚", "🪸", "🐝", "🦔", "🪶",
    "🌵", "🌴", "🌳", "🍁", "🪴", "🏕️", "⛺", "🚩", "🧭", "🗻", "🌁", "🪟"],
  ["#E7F0DC", "#DDEBF5", "#F3EBDC", "#E4F1EA", "#EFE7F3", "#FBF0DA"]
);

const WINDMILL_POOL = makePool(
  ["🌪️", "🎡", "🌀", "🍥", "☘️", "🌻", "⚙️", "🪁", "🎏", "🪃", "🛞", "🧿",
    "🎐", "🌺", "🌼", "🌸", "💫", "✨", "🔆", "☀️", "🌙", "⭐", "🪐", "🌈",
    "🍀", "🌿", "🪻", "🌹", "🌷", "💐", "🎠", "🎪", "🎈", "🪷", "🔮", "🎯"],
  ["#DDEFFA", "#F6E6F4", "#E9F3DD", "#FFF1D6", "#E4E6F8", "#FBE2E8"]
);

const DESSERT_POOL = makePool(
  ["🧁", "🍰", "🍪", "🍩", "🍫", "🍬", "🍭", "🍮", "🍯", "🥧", "🍦", "🍨",
    "🍧", "🥞", "🧇", "🥐", "🥨", "🍞", "🥖", "🧀", "🍇", "🍓", "🍒", "🍑",
    "🥝", "🍍", "🥥", "🍈", "🍉", "🍊", "🍋", "🍌", "🍎", "🍐", "🫐", "🥭"],
  ["#FFE9DC", "#F7EFD6", "#FFE1EA", "#E8F2DC", "#EDE6F6", "#DFEFF6"]
);

const GALA_POOL = makePool(
  ["🎉", "🎊", "🎈", "🎁", "🎀", "🪅", "🪩", "🎪", "🎠", "🎡", "🎢", "🎨",
    "🖼️", "🖌️", "🖍️", "✏️", "📐", "📏", "🧸", "🪁", "🎭", "🎬", "🎤", "🎧",
    "🎵", "🎶", "🥁", "🎷", "🎺", "🎸", "🪕", "🎻", "🪘", "🔔", "🏆", "🥇"],
  ["#F1E2FA", "#FFE4E9", "#E5EEFB", "#FFF3D8", "#E2F1E4", "#F6E7DA"]
);

export const THEME_TILES: Tile[][] = [
  ...LEGACY_THEME_TILES,
  SCROLL_POOL,
  WINDMILL_POOL,
  DESSERT_POOL,
  GALA_POOL
];

// ---------------------------------------------------------------------------
// 1.1 旋转块 / 缺块补齐的确定性生成（纯函数，可测试）
// ---------------------------------------------------------------------------

/**
 * 旋转风车园开局的朝向表：0=正着，1/2/3=顺时针转过 90/180/270 度。
 * 恰好有 wrong 块是歪的，同一个种子每次生成完全一样。
 */
export function buildRotations(rows: number, cols: number, wrong: number, seed: number): number[] {
  const n = Math.max(1, rows * cols);
  const rot = new Array<number>(n).fill(0);
  const rand = mulberry32(seed);
  const order = shuffled(Array.from({ length: n }, (_, i) => i), rand);
  const k = Math.max(1, Math.min(n, Math.round(wrong)));
  for (let i = 0; i < k; i++) rot[order[i]] = randInt(rand, 1, 3);
  return rot;
}

/** 把所有块都转正最少要点几下（每点一下顺时针 90 度） */
export function minRotateClicks(rot: readonly number[]): number {
  return rot.reduce((s, r) => s + ((4 - (((Math.round(r) % 4) + 4) % 4)) % 4), 0);
}

export interface FillPuzzle {
  /** 画里缺掉的格子（升序，值就是这一格该放的块号） */
  holes: number[];
  /** 托盘里的块号：缺块 + 若干干扰块，顺序已经打乱 */
  tray: number[];
}

/**
 * 缺块补齐的题面：从画里抠掉 missing 块，托盘里再混 extra 块干扰的。
 * 干扰块一律取自「画面之外」的素材，不会和画上已经摆着的块撞脸。
 */
export function buildFillPuzzle(
  rows: number,
  cols: number,
  missing: number,
  extra: number,
  seed: number,
  poolSize: number = NEW_POOL_SIZE
): FillPuzzle {
  const n = Math.max(1, rows * cols);
  const rand = mulberry32(seed);
  const k = Math.max(1, Math.min(n - 1, Math.round(missing)));
  const holes = shuffled(Array.from({ length: n }, (_, i) => i), rand).slice(0, k).sort((a, b) => a - b);
  const spare = Array.from({ length: Math.max(0, poolSize - n) }, (_, i) => n + i);
  const decoys = shuffled(spare, rand).slice(0, Math.max(0, Math.min(spare.length, Math.round(extra))));
  return { holes, tray: shuffled([...holes, ...decoys], rand) };
}

// ---------------------------------------------------------------------------
// 关卡生成
// ---------------------------------------------------------------------------

function stars(shuffleSteps: number): { three: number; two: number } {
  return { three: Math.max(10, shuffleSteps * 2), two: Math.max(20, Math.round(shuffleSteps * 3.5)) };
}

function buildLevel(ci: number, t: number): PuzzleLevel {
  switch (ci) {
    case 0: {
      const shuffleSteps = 8 + t * 3;
      return {
        rows: 3, cols: 3, shuffleSteps,
        moveLimit: Math.max(50, shuffleSteps * 6), hints: 3,
        hidePreview: false, theme: 0, ...stars(shuffleSteps)
      };
    }
    case 1: {
      const shuffleSteps = 30 + t * 4;
      return {
        rows: 3, cols: 3, shuffleSteps,
        moveLimit: Math.max(70, shuffleSteps * 5), hints: 3,
        hidePreview: false, theme: 1, ...stars(shuffleSteps)
      };
    }
    case 2: {
      const shuffleSteps = 24 + t * 4;
      return {
        rows: 3, cols: 4, shuffleSteps,
        moveLimit: Math.max(80, shuffleSteps * 6), hints: 3,
        hidePreview: false, theme: 2, ...stars(shuffleSteps)
      };
    }
    case 3: {
      const shuffleSteps = 16 + t * 3;
      return {
        rows: 3, cols: 3, shuffleSteps,
        moveLimit: Math.max(60, shuffleSteps * 6), hints: 4,
        hidePreview: true, theme: 3, ...stars(shuffleSteps)
      };
    }
    case 4: {
      const shuffleSteps = 30 + t * 5;
      return {
        rows: 4, cols: 4, shuffleSteps,
        moveLimit: Math.max(110, shuffleSteps * 6), hints: 4,
        hidePreview: false, theme: 4, ...stars(shuffleSteps)
      };
    }
    case 5: {
      const shuffleSteps = 40 + t * 5;
      const big = t % 2 === 1;
      return {
        rows: big ? 4 : 3, cols: 4, shuffleSteps,
        moveLimit: Math.max(120, shuffleSteps * 6), hints: 4,
        hidePreview: t % 3 === 2, theme: 5, ...stars(shuffleSteps)
      };
    }
    case 6: {
      // 巨幅长卷：5×5 的推格子拼图，后半段偶尔把完整图案藏起来
      const shuffleSteps = 30 + t * 4;
      return {
        rows: 5, cols: 5, shuffleSteps,
        moveLimit: Math.max(160, shuffleSteps * 6), hints: 5,
        hidePreview: t >= 16 && t % 4 === 3, theme: 6, ...stars(shuffleSteps)
      };
    }
    case 7: {
      // 旋转风车园：不推格子，点一下转 90°，歪的块越来越多、板子越来越大
      const side = t < 8 ? 3 : t < 16 ? 4 : 5;
      const wrong = Math.min(side * side, 4 + t);
      const seed = 70000 + t * 131;
      const need = minRotateClicks(buildRotations(side, side, wrong, seed));
      const two = need + Math.max(3, Math.ceil(need * 0.4));
      return {
        rows: side, cols: side, shuffleSteps: 0,
        moveLimit: two + Math.max(8, need), hints: 3,
        hidePreview: false, theme: 7,
        three: need, two,
        mode: "rotate", rotateWrong: wrong, seed
      };
    }
    case 8: {
      // 缺块补齐：缺的块和干扰块都越来越多，后半段换成 5×5
      const side = t < 10 ? 4 : 5;
      const missing = Math.min(side * side - 1, 3 + Math.floor(t / 3));
      const extra = 2 + Math.floor(t / 6);
      return {
        rows: side, cols: side, shuffleSteps: 0,
        moveLimit: missing + extra + 6, hints: 3,
        hidePreview: false, theme: 8,
        three: missing, two: missing + 2,
        mode: "fill", missing, extraPieces: extra, seed: 80000 + t * 137
      };
    }
    default: {
      // 限时大画展：沙漏一直在走，第 7 关起换成 6×6 的巨幅
      const shuffleSteps = 20 + t * 3;
      const side = t < 6 ? 5 : 6;
      return {
        rows: side, cols: side, shuffleSteps,
        moveLimit: Math.max(240, shuffleSteps * 8), hints: 5,
        hidePreview: false, theme: 9, ...stars(shuffleSteps),
        timeLimit: Math.max(200, 320 - t * 5)
      };
    }
  }
}

export const LEVELS: PuzzleLevel[] = (() => {
  const out: PuzzleLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();

// ---------------------------------------------------------------------------
// 1.1 无尽画廊（纯函数，可测试）
// ---------------------------------------------------------------------------

/** 无尽画廊每一幅的展厅名：每 4 幅换一间 */
export const ENDLESS_HALLS = ["晨光厅", "森林厅", "海风厅", "星河厅", "焰火厅"];

/** 无尽画廊第 round 幅（1 基）挂在哪个展厅 */
export function endlessHallName(round: number): string {
  const n = Math.max(1, Math.round(round) || 1);
  return ENDLESS_HALLS[Math.min(ENDLESS_HALLS.length - 1, Math.floor((n - 1) / 4))];
}

/**
 * 无尽画廊第 round 幅（1 基）：推格子 → 旋转 → 缺块三种玩法轮着来，
 * 板子和打乱步数随幅数变大，但都有封顶。
 */
export function endlessBoard(round: number): PuzzleLevel {
  const n = Math.max(1, Math.round(round) || 1);
  const k = Math.min(n - 1, 18);
  const theme = 6 + (n % 4);
  const seed = 90000 + n * 173;
  const kind = n % 3;
  if (kind === 1) {
    const side = k < 6 ? 3 : k < 12 ? 4 : 5;
    const wrong = Math.min(side * side, 4 + k);
    const need = minRotateClicks(buildRotations(side, side, wrong, seed));
    const two = need + Math.max(3, Math.ceil(need * 0.4));
    return {
      rows: side, cols: side, shuffleSteps: 0,
      moveLimit: two + Math.max(8, need), hints: 3,
      hidePreview: false, theme,
      three: need, two,
      mode: "rotate", rotateWrong: wrong, seed
    };
  }
  if (kind === 2) {
    const side = k < 8 ? 4 : 5;
    const missing = Math.min(side * side - 1, 3 + Math.floor(k / 2));
    const extra = 2 + Math.floor(k / 5);
    return {
      rows: side, cols: side, shuffleSteps: 0,
      moveLimit: missing + extra + 6, hints: 3,
      hidePreview: false, theme,
      three: missing, two: missing + 2,
      mode: "fill", missing, extraPieces: extra, seed
    };
  }
  const side = k < 5 ? 3 : k < 11 ? 4 : k < 16 ? 5 : 6;
  const shuffleSteps = 16 + k * 4;
  return {
    rows: side, cols: side, shuffleSteps,
    moveLimit: Math.max(160, shuffleSteps * 8), hints: 4,
    hidePreview: false, theme, ...stars(shuffleSteps),
    timeLimit: Math.max(150, 260 - k * 5)
  };
}

/** 无尽画廊收工时的一句话（只鼓励，不批评） */
export function endlessLine(done: number, best: number): string {
  if (done <= 0) return "第一幅还没拼完，别急，先看清完整图案再动手就顺了！";
  if (done > best) return `新纪录！你一口气拼好了 ${done} 幅画！`;
  return `这次拼好 ${done} 幅，最好成绩是 ${best} 幅，再来一次准能追上！`;
}
