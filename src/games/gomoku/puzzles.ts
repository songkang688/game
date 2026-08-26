// 五子棋「棋谜战役」:188 个 9×9 残局,黑棋先行,在限定步数内连成五。
// 分 9 大主题(入门成五 / 活三攻杀 / 跳冲妙手 / 冲四连环 / 双杀布阵 / 大师终局
// / 四手连环 / 活四陷阱 / 五步算杀)。
//
// 生成方式:37 个精心设计的"基础残局",配合棋盘对称变换(镜像 / 旋转 /
// 平移)扩展成 188 个互不相同的残局。对称变换不改变强制胜结构,
// 每一个残局都经过强制胜搜索验证(见 puzzles.test.ts):
// 无论白棋怎么挡,黑棋都能在 moves 步内取胜,而且不能提前偷解。
//
// 1.0 的前 99 道一字未动;1.1 追加的 89 道全部是 4 步 / 5 步算杀,
// 而且解法里黑棋每一手都不踩禁手(长连 / 双四 / 双三),
// 所以开着禁手规则也能照解。

import { makeBoard, setCell, type Board } from "./ai";

export interface PuzzleDef {
  name: string;
  tip: string;
  /** 棋盘大小(一年级用 9×9) */
  size: number;
  black: Array<[number, number]>;
  white: Array<[number, number]>;
  /** 黑棋最多可以走几步 */
  moves: number;
  /** 所属主题序号(0-8) */
  theme: number;
}

export interface ThemeDef {
  name: string;
  icon: string;
  blurb: string;
  /** 选关地图的底色(浅) */
  tint: string;
  /** 标题文字色(深) */
  ink: string;
}

/** 1.0 就有的残局数量,后面的都是 1.1 追加的 */
export const LEGACY_PUZZLES = 99;

/** 9 大主题(后 3 个是 1.1 新增) */
export const THEMES: ThemeDef[] = [
  { name: "入门·一箭成五", icon: "🎯", blurb: "找到那个能连成五颗的空位!", tint: "#E9F8DF", ink: "#4E7A3A" },
  { name: "活三攻杀", icon: "🌱", blurb: "先把活三长成活四,白棋就挡不住啦!", tint: "#DFF2F8", ink: "#2A6E8C" },
  { name: "跳冲妙手", icon: "🐇", blurb: "跳着连、双头冲,中间的洞就是关键!", tint: "#FFF3D6", ink: "#9A6B1F" },
  { name: "冲四连环", icon: "⚡", blurb: "先冲四逼白棋去挡,再开新杀招!", tint: "#F2E4FA", ink: "#7B3FA0" },
  { name: "双杀布阵", icon: "🗡️", blurb: "一颗子造出两个杀招,白棋顾此失彼!", tint: "#FFE4E9", ink: "#B03A5B" },
  { name: "大师终局", icon: "👑", blurb: "最难的残局都在这里,解开就是小棋王!", tint: "#E2E8F8", ink: "#3D5199" },
  { name: "四手连环", icon: "🔗", blurb: "一路冲四逼白棋跟着挡,第四手才收网!", tint: "#E6F6EF", ink: "#2F7A5C" },
  { name: "活四陷阱", icon: "🕸️", blurb: "把白棋一步步逼进死角,活四一亮就没得挡!", tint: "#FBEEDC", ink: "#8C5A22" },
  { name: "五步算杀", icon: "🌌", blurb: "整整五步的杀法,而且一手禁手都不用踩!", tint: "#E7E3F7", ink: "#4B3E8E" },
];

type P = [number, number];

interface BasePuzzle {
  name: string;
  tip: string;
  moves: number;
  black: P[];
  white: P[];
}

/**
 * 对称变换(9×9 棋盘,中心对称基准 8):
 * 0 原样 | 1 左右镜像 | 2 上下镜像 | 3 旋转180°
 * 4 主对角转置 | 5 旋转90° | 6 旋转270° | 7 副对角转置
 * 变换后再平移 (dx, dy)。
 */
function applySym(p: P, sym: number): P {
  const [x, y] = p;
  const c = 8;
  switch (sym) {
    case 1: return [c - x, y];
    case 2: return [x, c - y];
    case 3: return [c - x, c - y];
    case 4: return [y, x];
    case 5: return [c - y, x];
    case 6: return [y, c - x];
    case 7: return [c - y, c - x];
    default: return [x, y];
  }
}

interface VariantSpec {
  /** 变体名(与基础局名组合保证唯一) */
  name: string;
  sym: number;
  dx: number;
  dy: number;
  tip?: string;
}

function buildVariant(base: BasePuzzle, v: VariantSpec, theme: number): PuzzleDef {
  const map = (p: P): P => {
    const [x, y] = applySym(p, v.sym);
    return [x + v.dx, y + v.dy];
  };
  return {
    name: v.name,
    tip: v.tip ?? base.tip,
    size: 9,
    black: base.black.map(map),
    white: base.white.map(map),
    moves: base.moves,
    theme,
  };
}

/* ================= 基础残局(全部经强制胜验证) ================= */

// ---- 主题 0:一步成五 ----
const B_ARROW: BasePuzzle = {
  name: "一箭穿心",
  tip: "黑棋已经四连啦,找到那个空位!",
  moves: 1,
  black: [[2, 4], [3, 4], [4, 4], [5, 4]],
  white: [[2, 3], [3, 3], [4, 3], [2, 5]],
};
const B_PILLAR: BasePuzzle = {
  name: "顶天立地",
  tip: "竖着数一数,哪里能连成五个?",
  moves: 1,
  black: [[4, 2], [4, 3], [4, 4], [4, 5]],
  white: [[3, 2], [3, 3], [5, 4], [5, 5]],
};
const B_RAINBOW: BasePuzzle = {
  name: "斜斜的彩虹",
  tip: "斜着看!彩虹桥还差一块砖。",
  moves: 1,
  black: [[2, 2], [3, 3], [4, 4], [5, 5]],
  white: [[2, 4], [4, 2], [5, 3], [6, 4]],
};
const B_HOLE: BasePuzzle = {
  name: "中间缺一颗",
  tip: "四颗棋子中间有个小洞洞~",
  moves: 1,
  black: [[2, 6], [3, 6], [5, 6], [6, 6]],
  white: [[2, 5], [3, 5], [5, 7], [6, 7]],
};
const B_SLIDE: BasePuzzle = {
  name: "反斜滑梯",
  tip: "从右上滑到左下,补上哪一格?",
  moves: 1,
  black: [[6, 2], [5, 3], [4, 4], [3, 5]],
  white: [[5, 2], [4, 3], [6, 6], [2, 3]],
};
const B_EDGE4: BasePuzzle = {
  name: "贴边四连",
  tip: "贴着边也能赢!上下都看看。",
  moves: 1,
  black: [[5, 1], [5, 2], [5, 3], [5, 4]],
  white: [[4, 1], [4, 2], [6, 3], [6, 4]],
};

// ---- 主题 1:活三攻杀(两步) ----
const B_LIVE3: BasePuzzle = {
  name: "活三变活四",
  tip: "先把三颗连成两头都空的四颗,白棋就挡不住啦!",
  moves: 2,
  black: [[3, 4], [4, 4], [5, 4]],
  white: [[3, 3], [4, 3], [5, 5]],
};
const B_LIVE3V: BasePuzzle = {
  name: "竖起的活三",
  tip: "竖着的活三,往上或往下长一格!",
  moves: 2,
  black: [[4, 3], [4, 4], [4, 5]],
  white: [[3, 4], [5, 4], [3, 5]],
};
const B_LIVE3D: BasePuzzle = {
  name: "斜着的活三",
  tip: "斜线也一样:变成活四就赢定了。",
  moves: 2,
  black: [[3, 3], [4, 4], [5, 5]],
  white: [[4, 3], [3, 4], [5, 6]],
};
const B_LIVE3A: BasePuzzle = {
  name: "反斜活三",
  tip: "反斜线的活三,两头都是好地方。",
  moves: 2,
  black: [[6, 3], [5, 4], [4, 5]],
  white: [[5, 3], [6, 4], [4, 6]],
};
const B_LIVE3E: BasePuzzle = {
  name: "靠边活三",
  tip: "小心别顶到墙!往空的那头长。",
  moves: 2,
  black: [[2, 4], [3, 4], [4, 4]],
  white: [[2, 3], [3, 5], [4, 3]],
};

// ---- 主题 2:跳冲妙手(两步) ----
const B_JUMP3: BasePuzzle = {
  name: "跳跳三",
  tip: "两颗加一颗,中间的洞就是关键!",
  moves: 2,
  black: [[3, 4], [4, 4], [6, 4]],
  white: [[3, 3], [4, 5], [6, 5]],
};
const B_EDGEJUMP: BasePuzzle = {
  name: "边线跳冲",
  tip: "贴着边的跳三,补上洞就是活四!",
  moves: 2,
  black: [[1, 2], [1, 3], [1, 5]],
  white: [[2, 2], [2, 3], [0, 5]],
};
const B_DBLRUSH: BasePuzzle = {
  name: "双冲四星",
  tip: "找到那个能同时冲出两个四的交点!",
  moves: 2,
  black: [[2, 4], [3, 4], [4, 4], [5, 1], [5, 2], [5, 3]],
  white: [[1, 4], [5, 0], [0, 8], [8, 8], [1, 7], [7, 7]],
};

// ---- 主题 3:冲四连环(三步) ----
const B_TWOBIRDS: BasePuzzle = {
  name: "一石二鸟",
  tip: "先冲四逼白棋去挡,再竖着变活四!",
  moves: 3,
  black: [[2, 2], [3, 3], [4, 4], [5, 3], [5, 4]],
  white: [[1, 1], [2, 4], [6, 2], [7, 5], [3, 6]],
};
const B_VRUSH: BasePuzzle = {
  name: "竖冲横杀",
  tip: "竖着冲四逼一手,横着的活三就活啦!",
  moves: 3,
  black: [[4, 2], [4, 3], [4, 4], [2, 5], [3, 5]],
  white: [[4, 1], [5, 2], [2, 3], [6, 6], [5, 7]],
};

// ---- 主题 4:双杀布阵(三步) ----
const B_MIRRORBIRD: BasePuzzle = {
  name: "镜子二鸟",
  tip: "像照镜子一样!先逼再杀。",
  moves: 3,
  black: [[6, 2], [5, 3], [4, 4], [3, 3], [3, 4]],
  white: [[7, 1], [6, 4], [2, 2], [1, 5], [5, 6]],
};
const B_TURN: BasePuzzle = {
  name: "转个方向",
  tip: "斜线冲四,再横着开活四!",
  moves: 3,
  black: [[2, 2], [3, 3], [4, 4], [3, 5], [4, 5]],
  white: [[1, 1], [4, 2], [2, 6], [5, 7], [6, 3]],
};
const B_WAVE: BasePuzzle = {
  name: "横浪双杀",
  tip: "横线冲四逼一手,竖线的活三马上开花!",
  moves: 3,
  black: [[2, 4], [3, 4], [4, 4], [5, 5], [5, 6]],
  white: [[1, 4], [2, 6], [7, 2], [1, 7], [7, 7]],
};

/* ---- 1.1 新增:四步 / 五步强制胜基础残局(全部经强制胜搜索验证) ---- */

const Q4_0: BasePuzzle = {
  name: "四手连环",
  tip: "先冲一个四逼白棋去挡，挡完再看：四手之内一定连成五。",
  moves: 4,
  black: [[2, 2], [4, 4], [5, 3], [5, 4], [3, 1], [3, 2], [3, 4]],
  white: [[1, 1], [2, 4], [6, 2], [7, 5], [3, 6], [3, 0], [6, 0]],
};
const Q4_1: BasePuzzle = {
  name: "双臂冲锋",
  tip: "两条手臂各有杀招，先动哪一条要想清楚。",
  moves: 4,
  black: [[6, 2], [4, 4], [3, 3], [3, 4], [5, 1], [5, 2], [5, 4]],
  white: [[7, 1], [6, 4], [2, 2], [1, 5], [5, 6], [5, 0], [0, 0]],
};
const Q4_2: BasePuzzle = {
  name: "横梁架桥",
  tip: "横着那根梁先补齐，白棋一挡，斜线的活四就来了。",
  moves: 4,
  black: [[2, 2], [4, 4], [3, 5], [4, 5], [1, 3], [2, 3], [4, 3]],
  white: [[1, 1], [4, 2], [2, 6], [5, 7], [6, 3], [0, 3], [5, 0]],
};
const Q4_3: BasePuzzle = {
  name: "左墙攻势",
  tip: "靠着左墙的那一列先冲四，再回头收拾中间。",
  moves: 4,
  black: [[4, 4], [4, 5], [2, 3], [3, 3], [1, 2], [1, 4], [1, 5]],
  white: [[3, 4], [5, 4], [3, 5], [0, 3], [0, 0], [1, 1], [4, 0]],
};
const Q4_4: BasePuzzle = {
  name: "斜坡追击",
  tip: "顺着斜坡一路冲四，白棋只能跟着跑。",
  moves: 4,
  black: [[4, 2], [4, 4], [2, 5], [3, 5], [2, 1], [3, 2], [5, 4]],
  white: [[4, 1], [5, 2], [2, 3], [6, 6], [5, 7], [1, 0], [7, 0]],
};
const Q4_5: BasePuzzle = {
  name: "高墙连击",
  tip: "先在高墙那边冲四，白棋一挡，中路就空出来了。",
  moves: 4,
  black: [[4, 4], [4, 5], [2, 3], [3, 3], [1, 1], [1, 2], [1, 4]],
  white: [[3, 4], [5, 4], [3, 5], [0, 3], [0, 0], [1, 0], [4, 0]],
};
const Q4_6: BasePuzzle = {
  name: "长横破阵",
  tip: "长长的一横先冲四，再把竖着的三补成活四。",
  moves: 4,
  black: [[4, 2], [4, 3], [2, 5], [3, 5], [5, 4], [6, 4], [7, 4]],
  white: [[4, 1], [5, 2], [2, 3], [6, 6], [5, 7], [3, 4], [0, 0]],
};
const Q4_7: BasePuzzle = {
  name: "反斜设伏",
  tip: "反斜线上先冲一手，白棋挡完就掉进埋伏里。",
  moves: 4,
  black: [[5, 4], [1, 2], [2, 3], [4, 5], [3, 5], [5, 3], [6, 2]],
  white: [[3, 3], [4, 3], [5, 5], [0, 1], [4, 0], [2, 6], [8, 5]],
};
const Q4_8: BasePuzzle = {
  name: "三线交汇",
  tip: "三条线在一个点上交汇，先走哪条才不浪费步数？",
  moves: 4,
  black: [[2, 2], [4, 4], [5, 3], [5, 4], [3, 2], [3, 4], [3, 5]],
  white: [[1, 1], [2, 4], [6, 2], [7, 5], [3, 6], [6, 0], [7, 0]],
};
const Q5_0: BasePuzzle = {
  name: "五步登楼",
  tip: "像上楼梯一样，一层一层冲四，第五步登顶。",
  moves: 5,
  black: [[5, 4], [5, 2], [7, 4], [3, 5], [5, 5], [6, 5], [2, 1], [3, 1], [5, 1]],
  white: [[5, 3], [6, 4], [4, 6], [3, 0], [0, 0], [7, 5], [1, 0], [6, 1], [8, 0]],
};
const Q5_1: BasePuzzle = {
  name: "深谷追杀",
  tip: "白棋躲进深谷，黑棋要连追五步才追得上。",
  moves: 5,
  black: [[4, 5], [5, 2], [7, 4], [4, 3], [6, 5], [7, 6], [2, 1], [3, 1], [5, 1]],
  white: [[5, 3], [6, 4], [4, 6], [3, 0], [0, 0], [3, 2], [1, 0], [6, 1], [8, 0]],
};
const Q5_2: BasePuzzle = {
  name: "双翼齐飞",
  tip: "左右两翼轮流冲四，白棋顾了这边顾不了那边。",
  moves: 5,
  black: [[4, 4], [6, 4], [3, 5], [3, 7], [2, 5], [4, 7], [1, 2], [1, 3], [1, 5]],
  white: [[3, 3], [4, 5], [6, 5], [0, 0], [1, 0], [0, 3], [2, 0], [1, 1], [5, 0]],
};
const Q5_3: BasePuzzle = {
  name: "铁索连环",
  tip: "一环扣一环，每一手都逼着白棋挡，一步都不能省。",
  moves: 5,
  black: [[5, 4], [2, 3], [4, 5], [5, 6], [3, 5], [5, 3], [3, 2], [4, 2], [5, 2]],
  white: [[3, 3], [4, 3], [5, 5], [1, 2], [0, 0], [2, 6], [1, 0], [2, 2], [8, 1]],
};
const Q5_4: BasePuzzle = {
  name: "层层设伏",
  tip: "前四手都是幌子，真正的杀招藏在第五手。",
  moves: 5,
  black: [[5, 4], [2, 3], [4, 5], [3, 5], [5, 3], [6, 2], [2, 2], [3, 2], [4, 2]],
  white: [[3, 3], [4, 3], [5, 5], [0, 1], [4, 0], [2, 6], [8, 5], [5, 2], [0, 6]],
};
const Q5_5: BasePuzzle = {
  name: "九曲回廊",
  tip: "杀法拐了好几个弯，顺着冲四的顺序慢慢找。",
  moves: 5,
  black: [[2, 2], [4, 4], [5, 3], [5, 4], [3, 4], [3, 5], [1, 4], [2, 3], [4, 1]],
  white: [[1, 1], [2, 4], [6, 2], [7, 5], [3, 6], [6, 0], [7, 0], [0, 5], [8, 0]],
};
const Q5_6: BasePuzzle = {
  name: "顶楼突围",
  tip: "顶上那排先冲四，白棋挡完，中路的活四就成型了。",
  moves: 5,
  black: [[3, 3], [4, 4], [3, 5], [4, 5], [2, 1], [2, 3], [1, 0], [3, 0], [4, 0]],
  white: [[1, 1], [4, 2], [2, 6], [5, 7], [6, 3], [5, 0], [6, 0], [7, 0], [8, 0]],
};
const Q5_7: BasePuzzle = {
  name: "右岸长堤",
  tip: "右边的长堤一路冲过去，第五手收网。",
  moves: 5,
  black: [[5, 4], [5, 2], [7, 4], [5, 5], [6, 5], [7, 5], [3, 1], [5, 1], [6, 1]],
  white: [[5, 3], [6, 4], [4, 6], [8, 5], [0, 0], [1, 0], [8, 0], [2, 1], [0, 1]],
};
const Q5_8: BasePuzzle = {
  name: "收官五步",
  tip: "整整五步的算杀，把每一手的挡点都想到才不会走错。",
  moves: 5,
  black: [[2, 2], [5, 3], [5, 4], [3, 1], [3, 2], [3, 4], [4, 5], [4, 6], [4, 7]],
  white: [[1, 1], [2, 4], [6, 2], [7, 5], [3, 6], [3, 0], [6, 0], [4, 3], [7, 0]],
};

/* ================= 按主题展开成 188 个残局 ================= */

interface ThemePlan {
  theme: number;
  groups: Array<{ base: BasePuzzle; variants: VariantSpec[] }>;
}

const PLANS: ThemePlan[] = [
  {
    // 主题 0:一步成五,17 关
    theme: 0,
    groups: [
      {
        base: B_ARROW,
        variants: [
          { name: "一箭穿心", sym: 0, dx: 0, dy: 0 },
          { name: "一箭穿心·南巡", sym: 2, dx: 0, dy: -1 },
          { name: "一箭穿心·回眸", sym: 1, dx: 0, dy: 2 },
        ],
      },
      {
        base: B_PILLAR,
        variants: [
          { name: "顶天立地", sym: 0, dx: 0, dy: 0 },
          { name: "顶天立地·迁东", sym: 2, dx: 2, dy: 0 },
          { name: "顶天立地·横卧", sym: 4, dx: 0, dy: -1, tip: "柱子躺下啦!横着数一数。" },
        ],
      },
      {
        base: B_RAINBOW,
        variants: [
          { name: "斜斜的彩虹", sym: 0, dx: 0, dy: 0 },
          { name: "彩虹·雨后", sym: 3, dx: 0, dy: 0 },
          { name: "彩虹·倒影", sym: 1, dx: 0, dy: 1, tip: "彩虹照进湖里,斜的方向反过来啦!" },
        ],
      },
      {
        base: B_HOLE,
        variants: [
          { name: "中间缺一颗", sym: 0, dx: 0, dy: 0 },
          { name: "缺一颗·天窗", sym: 2, dx: 0, dy: 0, tip: "洞洞跑到上面去了,补哪里?" },
          { name: "缺一颗·竖井", sym: 4, dx: 0, dy: 0, tip: "竖着的四颗中间也有洞!" },
        ],
      },
      {
        base: B_SLIDE,
        variants: [
          { name: "反斜滑梯", sym: 0, dx: 0, dy: 0 },
          { name: "滑梯·换边", sym: 1, dx: 0, dy: 0 },
        ],
      },
      {
        base: B_EDGE4,
        variants: [
          { name: "贴边四连", sym: 0, dx: 0, dy: 0 },
          { name: "贴边·左墙", sym: 4, dx: 0, dy: 0, tip: "这次贴着左边的墙,横着看!" },
          { name: "贴边·地板", sym: 2, dx: -1, dy: 0 },
        ],
      },
    ],
  },
  {
    // 主题 1:活三攻杀,17 关
    theme: 1,
    groups: [
      {
        base: B_LIVE3,
        variants: [
          { name: "活三变活四", sym: 0, dx: 0, dy: 0 },
          { name: "活三·北上", sym: 2, dx: 0, dy: -1 },
          { name: "活三·换镜", sym: 1, dx: 0, dy: 1 },
          { name: "活三·挪窝", sym: 3, dx: 1, dy: 0 },
        ],
      },
      {
        base: B_LIVE3V,
        variants: [
          { name: "竖起的活三", sym: 0, dx: 0, dy: 0 },
          { name: "竖活三·东墙", sym: 1, dx: -1, dy: 0 },
          { name: "竖活三·翻身", sym: 3, dx: 0, dy: 1 },
        ],
      },
      {
        base: B_LIVE3D,
        variants: [
          { name: "斜着的活三", sym: 0, dx: 0, dy: 0 },
          { name: "斜活三·晨光", sym: 3, dx: 0, dy: 0 },
          { name: "斜活三·左坡", sym: 1, dx: 0, dy: 0 },
        ],
      },
      {
        base: B_LIVE3A,
        variants: [
          { name: "反斜活三", sym: 0, dx: 0, dy: 0 },
          { name: "反斜·晚霞", sym: 3, dx: 0, dy: 0 },
          { name: "反斜·清泉", sym: 2, dx: 0, dy: 0 },
        ],
      },
      {
        base: B_LIVE3E,
        variants: [
          { name: "靠边活三", sym: 0, dx: 0, dy: 0 },
          { name: "靠边·右岸", sym: 1, dx: 0, dy: 0 },
          { name: "靠边·屋檐", sym: 5, dx: 0, dy: 0, tip: "活三竖起来靠着屋檐,往空的那头长!" },
          { name: "靠边·井底", sym: 6, dx: 0, dy: 0 },
        ],
      },
    ],
  },
  {
    // 主题 2:跳冲妙手,17 关
    theme: 2,
    groups: [
      {
        base: B_JUMP3,
        variants: [
          { name: "跳跳三", sym: 0, dx: 0, dy: 0 },
          { name: "跳跳三·长耳", sym: 1, dx: 0, dy: 0 },
          { name: "跳跳三·竖跳", sym: 4, dx: 0, dy: 0, tip: "竖着跳!洞洞在中间等你。" },
          { name: "跳跳三·蹦床", sym: 3, dx: 0, dy: -1 },
          { name: "跳跳三·斜风", sym: 5, dx: 0, dy: 0 },
          { name: "跳跳三·细雨", sym: 6, dx: 0, dy: 0 },
        ],
      },
      {
        base: B_EDGEJUMP,
        variants: [
          { name: "边线跳冲", sym: 0, dx: 0, dy: 0 },
          { name: "边线·右堤", sym: 1, dx: 0, dy: 0 },
          { name: "边线·天桥", sym: 4, dx: 0, dy: 0, tip: "贴着天花板的跳三,横着补!" },
          { name: "边线·地铁", sym: 7, dx: 0, dy: 0 },
          { name: "边线·靠里", sym: 0, dx: 2, dy: 1, tip: "离墙远一点,道理还是一样!" },
        ],
      },
      {
        base: B_DBLRUSH,
        variants: [
          { name: "双冲四星", sym: 0, dx: 0, dy: 0 },
          { name: "双冲·换角", sym: 1, dx: 0, dy: 0 },
          { name: "双冲·倒挂", sym: 3, dx: 0, dy: 0 },
          { name: "双冲·侧影", sym: 4, dx: 0, dy: 0 },
          { name: "双冲·风车", sym: 5, dx: 0, dy: 0 },
          { name: "双冲·雷雨", sym: 7, dx: 0, dy: 0 },
        ],
      },
    ],
  },
  {
    // 主题 3:冲四连环,16 关
    theme: 3,
    groups: [
      {
        base: B_TWOBIRDS,
        variants: [
          { name: "一石二鸟", sym: 0, dx: 0, dy: 0 },
          { name: "二鸟·西枝", sym: 1, dx: 0, dy: 0 },
          { name: "二鸟·南巢", sym: 2, dx: 0, dy: 0 },
          { name: "二鸟·倒影", sym: 3, dx: 0, dy: 0 },
          { name: "二鸟·晨飞", sym: 4, dx: 0, dy: 0 },
          { name: "二鸟·暮归", sym: 7, dx: 0, dy: 0 },
          { name: "二鸟·旋风", sym: 5, dx: 0, dy: 0 },
          { name: "二鸟·细浪", sym: 6, dx: 0, dy: 0 },
        ],
      },
      {
        base: B_VRUSH,
        variants: [
          { name: "竖冲横杀", sym: 0, dx: 0, dy: 0 },
          { name: "竖冲·换幕", sym: 1, dx: 0, dy: 0 },
          { name: "竖冲·雪原", sym: 2, dx: 0, dy: 0 },
          { name: "竖冲·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "横冲竖杀", sym: 4, dx: 0, dy: 0, tip: "这次横着冲四,竖着的活三开花!" },
          { name: "横冲·北风", sym: 5, dx: 0, dy: 0 },
          { name: "横冲·麦浪", sym: 6, dx: 0, dy: 0 },
          { name: "横冲·星桥", sym: 7, dx: 0, dy: 0 },
        ],
      },
    ],
  },
  {
    // 主题 4:双杀布阵,16 关
    theme: 4,
    groups: [
      {
        // 与主题 3 的同族布局整体下移一格,保证 99 关布局互不相同
        base: B_MIRRORBIRD,
        variants: [
          { name: "镜子二鸟", sym: 0, dx: 0, dy: 1 },
          { name: "镜鸟·出岫", sym: 1, dx: 0, dy: 1 },
          { name: "镜鸟·入林", sym: 2, dx: 0, dy: 1 },
          { name: "镜鸟·衔枝", sym: 3, dx: 0, dy: 1 },
          { name: "镜鸟·望月", sym: 4, dx: 0, dy: 1 },
          { name: "镜鸟·踏雪", sym: 5, dx: 0, dy: 1 },
        ],
      },
      {
        base: B_TURN,
        variants: [
          { name: "转个方向", sym: 0, dx: 1, dy: 0 },
          { name: "转向·东谷", sym: 1, dx: 1, dy: 0 },
          { name: "转向·南坡", sym: 2, dx: 1, dy: 0 },
          { name: "转向·飞檐", sym: 4, dx: 1, dy: 0 },
          { name: "转向·龙脊", sym: 7, dx: 1, dy: 0 },
        ],
      },
      {
        base: B_WAVE,
        variants: [
          { name: "横浪双杀", sym: 0, dx: 0, dy: 0 },
          { name: "横浪·退潮", sym: 1, dx: 0, dy: 0 },
          { name: "横浪·涨潮", sym: 2, dx: 0, dy: 0 },
          { name: "竖浪双杀", sym: 4, dx: 0, dy: 0, tip: "浪头竖起来了!先冲四再开活四。" },
          { name: "竖浪·涛声", sym: 5, dx: 0, dy: 0 },
        ],
      },
    ],
  },
  {
    // 主题 5:大师终局,16 关(全部三步大杀局的高阶变体)
    theme: 5,
    groups: [
      {
        base: B_TWOBIRDS,
        variants: [
          { name: "大师·丹顶鹤", sym: 5, dx: -1, dy: 0 },
          { name: "大师·雪中松", sym: 6, dx: -1, dy: 0 },
          { name: "大师·月下溪", sym: 7, dx: -1, dy: 0 },
        ],
      },
      {
        base: B_VRUSH,
        variants: [
          { name: "大师·惊雷式", sym: 5, dx: 0, dy: 1 },
          { name: "大师·卷帘式", sym: 6, dx: 0, dy: -1 },
          { name: "大师·穿云式", sym: 7, dx: 1, dy: 0 },
        ],
      },
      {
        base: B_MIRRORBIRD,
        variants: [
          { name: "大师·双镜阁", sym: 6, dx: 0, dy: -1 },
          { name: "大师·琉璃塔", sym: 7, dx: 0, dy: -1 },
          { name: "大师·万花筒", sym: 3, dx: 0, dy: -1 },
        ],
      },
      {
        base: B_TURN,
        variants: [
          { name: "大师·风向标", sym: 3, dx: 1, dy: 1 },
          { name: "大师·罗盘阵", sym: 5, dx: 1, dy: 1 },
          { name: "大师·螺旋梯", sym: 6, dx: 1, dy: 1 },
          { name: "大师·观星台", sym: 7, dx: 1, dy: 1 },
        ],
      },
      {
        base: B_WAVE,
        variants: [
          { name: "大师·惊涛式", sym: 3, dx: 0, dy: 0 },
          { name: "大师·浪淘沙", sym: 6, dx: 0, dy: 0 },
          { name: "大师·海上虹", sym: 7, dx: -1, dy: 0 },
        ],
      },
    ],
  },
{
    theme: 6,
    groups: [
      {
        base: Q4_0,
        variants: [
          { name: "四手连环", sym: 0, dx: 0, dy: 0 },
          { name: "四手连环·东风", sym: 1, dx: 0, dy: 0 },
          { name: "四手连环·南望", sym: 2, dx: 0, dy: 0 },
          { name: "四手连环·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "四手连环·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q4_1,
        variants: [
          { name: "双臂冲锋", sym: 0, dx: 0, dy: 0 },
          { name: "双臂冲锋·东风", sym: 1, dx: 0, dy: 0 },
          { name: "双臂冲锋·南望", sym: 2, dx: 0, dy: 0 },
          { name: "双臂冲锋·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "双臂冲锋·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q4_2,
        variants: [
          { name: "横梁架桥", sym: 0, dx: 0, dy: 0 },
          { name: "横梁架桥·东风", sym: 1, dx: 0, dy: 0 },
          { name: "横梁架桥·南望", sym: 2, dx: 0, dy: 0 },
          { name: "横梁架桥·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "横梁架桥·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q4_3,
        variants: [
          { name: "左墙攻势", sym: 0, dx: 0, dy: 0 },
          { name: "左墙攻势·东风", sym: 1, dx: 0, dy: 0 },
          { name: "左墙攻势·南望", sym: 2, dx: 0, dy: 0 },
          { name: "左墙攻势·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "左墙攻势·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q4_4,
        variants: [
          { name: "斜坡追击", sym: 0, dx: 0, dy: 0 },
          { name: "斜坡追击·东风", sym: 1, dx: 0, dy: 0 },
          { name: "斜坡追击·南望", sym: 2, dx: 0, dy: 0 },
          { name: "斜坡追击·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "斜坡追击·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q4_5,
        variants: [
          { name: "高墙连击", sym: 0, dx: 0, dy: 0 },
          { name: "高墙连击·东风", sym: 1, dx: 0, dy: 0 },
          { name: "高墙连击·南望", sym: 2, dx: 0, dy: 0 },
          { name: "高墙连击·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "高墙连击·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
    ],
  },   // 主题 6 共 30 关
  {
    theme: 7,
    groups: [
      {
        base: Q4_6,
        variants: [
          { name: "长横破阵", sym: 0, dx: 0, dy: 0 },
          { name: "长横破阵·东风", sym: 1, dx: 0, dy: 0 },
          { name: "长横破阵·南望", sym: 2, dx: 0, dy: 0 },
          { name: "长横破阵·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "长横破阵·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q4_7,
        variants: [
          { name: "反斜设伏", sym: 0, dx: 0, dy: 0 },
          { name: "反斜设伏·东风", sym: 1, dx: 0, dy: 0 },
          { name: "反斜设伏·南望", sym: 2, dx: 0, dy: 0 },
          { name: "反斜设伏·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "反斜设伏·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q4_8,
        variants: [
          { name: "三线交汇", sym: 0, dx: 0, dy: 0 },
          { name: "三线交汇·东风", sym: 1, dx: 0, dy: 0 },
          { name: "三线交汇·南望", sym: 2, dx: 0, dy: 0 },
          { name: "三线交汇·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "三线交汇·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q5_0,
        variants: [
          { name: "五步登楼", sym: 0, dx: 0, dy: 0 },
          { name: "五步登楼·东风", sym: 1, dx: 0, dy: 0 },
          { name: "五步登楼·南望", sym: 2, dx: 0, dy: 0 },
          { name: "五步登楼·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "五步登楼·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q5_1,
        variants: [
          { name: "深谷追杀", sym: 0, dx: 0, dy: 0 },
          { name: "深谷追杀·东风", sym: 1, dx: 0, dy: 0 },
          { name: "深谷追杀·南望", sym: 2, dx: 0, dy: 0 },
          { name: "深谷追杀·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "深谷追杀·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q5_2,
        variants: [
          { name: "双翼齐飞", sym: 0, dx: 0, dy: 0 },
          { name: "双翼齐飞·东风", sym: 1, dx: 0, dy: 0 },
          { name: "双翼齐飞·南望", sym: 2, dx: 0, dy: 0 },
          { name: "双翼齐飞·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "双翼齐飞·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
    ],
  },   // 主题 7 共 30 关
  {
    theme: 8,
    groups: [
      {
        base: Q5_3,
        variants: [
          { name: "铁索连环", sym: 0, dx: 0, dy: 0 },
          { name: "铁索连环·东风", sym: 1, dx: 0, dy: 0 },
          { name: "铁索连环·南望", sym: 2, dx: 0, dy: 0 },
          { name: "铁索连环·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "铁索连环·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q5_4,
        variants: [
          { name: "层层设伏", sym: 0, dx: 0, dy: 0 },
          { name: "层层设伏·东风", sym: 1, dx: 0, dy: 0 },
          { name: "层层设伏·南望", sym: 2, dx: 0, dy: 0 },
          { name: "层层设伏·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "层层设伏·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q5_5,
        variants: [
          { name: "九曲回廊", sym: 0, dx: 0, dy: 0 },
          { name: "九曲回廊·东风", sym: 1, dx: 0, dy: 0 },
          { name: "九曲回廊·南望", sym: 2, dx: 0, dy: 0 },
          { name: "九曲回廊·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "九曲回廊·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q5_6,
        variants: [
          { name: "顶楼突围", sym: 0, dx: 0, dy: 0 },
          { name: "顶楼突围·东风", sym: 1, dx: 0, dy: 0 },
          { name: "顶楼突围·南望", sym: 2, dx: 0, dy: 0 },
          { name: "顶楼突围·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "顶楼突围·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q5_7,
        variants: [
          { name: "右岸长堤", sym: 0, dx: 0, dy: 0 },
          { name: "右岸长堤·东风", sym: 1, dx: 0, dy: 0 },
          { name: "右岸长堤·南望", sym: 2, dx: 0, dy: 0 },
          { name: "右岸长堤·回旋", sym: 3, dx: 0, dy: 0 },
          { name: "右岸长堤·晨曦", sym: 4, dx: 0, dy: 0 },
        ],
      },
      {
        base: Q5_8,
        variants: [
          { name: "收官五步", sym: 0, dx: 0, dy: 0 },
          { name: "收官五步·东风", sym: 1, dx: 0, dy: 0 },
          { name: "收官五步·南望", sym: 2, dx: 0, dy: 0 },
          { name: "收官五步·回旋", sym: 3, dx: 0, dy: 0 },
        ],
      },
    ],
  },   // 主题 8 共 29 关
];

/** 全部 188 个残局,按主题顺序排列 */
export const PUZZLES: PuzzleDef[] = PLANS.flatMap((plan) =>
  plan.groups.flatMap((g) => g.variants.map((v) => buildVariant(g.base, v, plan.theme)))
);

/** 主题 t 的第一个残局在 PUZZLES 里的下标 */
export function themeStart(t: number): number {
  let idx = 0;
  for (let i = 0; i < t; i++) idx += PUZZLES.filter((p) => p.theme === i).length;
  return idx;
}

/** 主题 t 的残局列表 */
export function puzzlesOfTheme(t: number): PuzzleDef[] {
  return PUZZLES.filter((p) => p.theme === t);
}

/** 把残局摆到新棋盘上(黑=1 白=2) */
export function puzzleBoard(p: PuzzleDef): Board {
  const b = makeBoard(p.size);
  for (const [x, y] of p.black) setCell(b, x, y, 1);
  for (const [x, y] of p.white) setCell(b, x, y, 2);
  return b;
}

/**
 * 读旧存档:1.0 存的是长度 99 的星级数组,1.1 有 188 道。
 * 前 99 位原样保留,后面补 0;脏数据一律当 0。
 */
export function parseCampaignStars(raw: unknown): number[] {
  const arr = Array.isArray(raw) ? raw : [];
  return PUZZLES.map((_, i) => {
    const v = arr[i];
    if (typeof v !== "number" || !Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(3, Math.round(v)));
  });
}

/* ---------------- 残局结算朗读 ---------------- */
// 残局逐题结算不走平台弹窗（自动进下一题），识字量有限的孩子靠听。
// 纯函数便于测试；朗读本身走 speech.ts，无中文语音包时静默降级。

/** 残局解开时要朗读的整句话。 */
export function puzzleSolvedSpeechLine(hintUsed: boolean): string {
  return hintUsed
    ? "解开啦！下次不用提示，能拿三颗星哦！"
    : "太棒了！不用提示就解开，三颗星到手！";
}

/** 残局失败时要朗读的整句话：报第一步正解方向（列/行从 1 数起），没有就纯安抚。 */
export function puzzleFailSpeechLine(opening: { x: number; y: number } | null): string {
  return opening
    ? `没关系！第一步试试第 ${opening.x + 1} 列、第 ${opening.y + 1} 行附近，点重摆再来一次！`
    : "没关系！点重摆，再想一想！";
}
