/**
 * 朵朵大战星星 · 出场名单（纯数据）。
 * 全部是本作原创的小伙伴，体重 / 速度 / 跳跃 / 力度各不相同：
 * 轻的跑得快但容易被撞飞，沉的稳当却慢半拍，谁都有自己的活法。
 */

export interface Fighter {
  /** 内部 id，只用小写字母 */
  id: string;
  /** 中文名 */
  name: string;
  emoji: string;
  /** 身体颜色（粉彩） */
  color: string;
  /** 体重：越大越难被弹飞（基准 100） */
  weight: number;
  /** 跑动速度倍率 */
  speed: number;
  /** 跳跃力倍率 */
  jump: number;
  /** 挥击力度倍率 */
  power: number;
  /** 空中还能跳几次 */
  airJumps: number;
  /** 一句话介绍 */
  tip: string;
}

export const ROSTER: Fighter[] = [
  {
    id: "duoduo",
    name: "朵朵",
    emoji: "🌸",
    color: "#ff9ec4",
    weight: 100,
    speed: 1.0,
    jump: 1.0,
    power: 1.0,
    airJumps: 1,
    tip: "样样都行的全能选手，第一次玩就选她准没错。",
  },
  {
    id: "xingxing",
    name: "星星",
    emoji: "⭐",
    color: "#ffd75e",
    weight: 92,
    speed: 1.12,
    jump: 1.06,
    power: 0.94,
    airJumps: 1,
    tip: "身手灵巧，绕到侧面偷偷补一下最拿手。",
  },
  {
    id: "nuonuo",
    name: "糯糯",
    emoji: "🍡",
    color: "#f7c8dd",
    weight: 118,
    speed: 0.88,
    jump: 0.92,
    power: 1.14,
    airJumps: 1,
    tip: "软软的却很沉，站在场地中间就是一堵墙。",
  },
  {
    id: "yunyun",
    name: "云云",
    emoji: "☁️",
    color: "#bcd8ff",
    weight: 78,
    speed: 1.06,
    jump: 1.2,
    power: 0.86,
    airJumps: 2,
    tip: "飘得高、回得来，被撞飞了也常常能自己飘回场地。",
  },
  {
    id: "dundun",
    name: "墩墩",
    emoji: "🧸",
    color: "#e3b98f",
    weight: 132,
    speed: 0.82,
    jump: 0.86,
    power: 1.24,
    airJumps: 1,
    tip: "全场最沉，一记重击能把人送出老远。",
  },
  {
    id: "shanshan",
    name: "闪闪",
    emoji: "✨",
    color: "#ffe89a",
    weight: 84,
    speed: 1.24,
    jump: 1.1,
    power: 0.84,
    airJumps: 1,
    tip: "跑得最快，靠一串轻击把对手的击退值慢慢磨上去。",
  },
  {
    id: "lvlvdou",
    name: "绿绿豆",
    emoji: "🫛",
    color: "#a8dda0",
    weight: 96,
    speed: 1.02,
    jump: 1.08,
    power: 1.0,
    airJumps: 1,
    tip: "跳得比看上去高，抢空中的道具很有一手。",
  },
  {
    id: "jiujiu",
    name: "啾啾",
    emoji: "🐤",
    color: "#ffe07a",
    weight: 72,
    speed: 1.16,
    jump: 1.26,
    power: 0.8,
    airJumps: 2,
    tip: "最轻最会跳，缺点也很明显——一撞就飞。",
  },
  {
    id: "paopao",
    name: "泡泡",
    emoji: "🫧",
    color: "#c9ecff",
    weight: 80,
    speed: 1.08,
    jump: 1.16,
    power: 0.88,
    airJumps: 2,
    tip: "轻飘飘地黏着人打，专挑对手落地那一下。",
  },
  {
    id: "tuantuan",
    name: "团团",
    emoji: "🍙",
    color: "#f2ede1",
    weight: 124,
    speed: 0.86,
    jump: 0.9,
    power: 1.2,
    airJumps: 1,
    tip: "稳稳当当守着平台边，谁靠近就来一下。",
  },
  {
    id: "maimai",
    name: "麦麦",
    emoji: "🌾",
    color: "#f0d9a0",
    weight: 104,
    speed: 0.98,
    jump: 1.0,
    power: 1.06,
    airJumps: 1,
    tip: "力气比看着大一点，正面硬碰硬也不吃亏。",
  },
  {
    id: "dengdeng",
    name: "灯灯",
    emoji: "🏮",
    color: "#ffb3a7",
    weight: 110,
    speed: 0.92,
    jump: 0.96,
    power: 1.12,
    airJumps: 1,
    tip: "慢工出细活，重击攒够了一下就见分晓。",
  },
];

/** 按 id 找角色，找不到就退回朵朵，绝不返回 undefined */
export function fighterById(id: string): Fighter {
  return ROSTER.find((f) => f.id === id) ?? ROSTER[0];
}

/** 按下标取角色（自动绕圈），关卡表用它排对手 */
export function fighterAt(index: number): Fighter {
  const n = ROSTER.length;
  const i = ((Math.trunc(index) % n) + n) % n;
  return ROSTER[i];
}

/** 队伍配色：0 号粉队、1 号蓝队、2 号绿队、3 号黄队 */
export const TEAM_COLORS = ["#ff8fbe", "#7fb2ff", "#8fd6a4", "#ffd166"];
export const TEAM_NAMES = ["粉粉队", "蓝蓝队", "绿绿队", "黄黄队"];
