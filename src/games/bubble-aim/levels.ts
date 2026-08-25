// 泡泡瞄准关卡：偶数行 9 格、奇数行 8 格（右移半格），'.' 为空。
// 颜色：R 草莓红 Y 柠檬黄 B 天空蓝 G 苹果绿 P 葡萄紫。

export interface BubbleLevelDef {
  name: string;
  tip: string;
  layout: string[];
  /** 本关子弹数 */
  shots: number;
}

export const LEVELS: BubbleLevelDef[] = [
  {
    name: "三色小塔",
    tip: "对准同色的泡泡发射，凑齐 3 个就爆！",
    layout: [
      "RRRGGGBBB",
      "RRRGGBBB",
      ".RRGGGBB.",
    ],
    shots: 16,
  },
  {
    name: "彩虹拱门",
    tip: "试试打拱门的柱子，上面的会一起掉下来！",
    layout: [
      "BBBBBBBBB",
      "BYYYYYYB",
      "BYRRRRRYB",
      "BY.RR.YB",
      "BY.....YB",
    ],
    shots: 22,
  },
  {
    name: "小花田",
    tip: "贴着墙打，泡泡会反弹到花丛后面！",
    layout: [
      "GGGGGGGGG",
      "GRRGGPPG",
      "GRYRGPYPG",
      "GGYYGYYG",
      "....G....",
    ],
    shots: 22,
  },
  {
    name: "蜂窝彩条",
    tip: "一条一条消，看看哪条最好打！",
    layout: [
      "RYBGRYBGR",
      "RYBGRYBG",
      "RYBGRYBGR",
      "RYBGRYBG",
    ],
    shots: 24,
  },
  {
    name: "甜心爱心",
    tip: "从爱心的小尖尖开始往上消！",
    layout: [
      ".RR...RR.",
      "RPPRRPPR",
      "RPPYYYPPR",
      ".RPYYPR.",
      "..RPPPR..",
      "...RR...",
      "....R....",
    ],
    shots: 24,
  },
  {
    name: "星星大阵",
    tip: "五种颜色的大挑战，你是泡泡神射手！",
    layout: [
      "PPBBYBBPP",
      "PPBYYBPP",
      "GGRRYRRGG",
      "GGRRYRGG",
      "..GGRGG..",
      "...GG...",
    ],
    shots: 30,
  },
];
