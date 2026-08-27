/**
 * 记忆翻翻乐 · 1.2 原创图案库。
 *
 * 六套主题、每套 12 个图案,全部是本作自己画的几何形状 —— 不用任何字体表情、
 * 不引外链素材,也不出现任何商标或别人家的角色。
 *
 * 每个图案写成一小串形状(画在 0..100 的方框里),渲染时按卡片大小等比放大。
 * 这样图案本身是**纯数据**,单测可以逐个体检;画的那一步只有一个 `drawIcon`。
 */

export type Shape =
  /** 圆 */
  | { t: "c"; x: number; y: number; r: number; f: string }
  /** 椭圆（a 是旋转弧度） */
  | { t: "e"; x: number; y: number; rx: number; ry: number; f: string; a?: number }
  /** 圆角矩形 */
  | { t: "r"; x: number; y: number; w: number; h: number; f: string; rd?: number }
  /** 多边形（pts 是 x,y 交替） */
  | { t: "p"; pts: number[]; f: string }
  /** 折线 */
  | { t: "l"; pts: number[]; s: string; w: number }
  /** 圆弧线 */
  | { t: "a"; x: number; y: number; r: number; from: number; to: number; s: string; w: number };

export interface Icon {
  /** 中文名：牌面下方会写出来，图案 + 名字双通道帮助识别 */
  name: string;
  shapes: Shape[];
}

export interface ThemePack {
  id: string;
  name: string;
  /** 卡背底色，六套各一种 */
  back: string;
  icons: Icon[];
}

// --- 形状小工具：让下面的图案表写得短一点 ---------------------------------

const c = (x: number, y: number, r: number, f: string): Shape => ({ t: "c", x, y, r, f });
const e = (x: number, y: number, rx: number, ry: number, f: string, a = 0): Shape =>
  ({ t: "e", x, y, rx, ry, f, a });
const box = (x: number, y: number, w: number, h: number, f: string, rd = 0): Shape =>
  ({ t: "r", x, y, w, h, f, rd });
const poly = (f: string, ...pts: number[]): Shape => ({ t: "p", pts, f });
const line = (s: string, w: number, ...pts: number[]): Shape => ({ t: "l", pts, s, w });
const arc = (x: number, y: number, r: number, from: number, to: number, s: string, w: number): Shape =>
  ({ t: "a", x, y, r, from, to, s, w });

const INK = "#3B3B4F";
const WHITE = "#FFFFFF";

/** 两只眼睛 + 一个小嘴：所有小动物 / 家人共用这张脸 */
function face(y = 52, gap = 11, smile = true): Shape[] {
  const out: Shape[] = [c(50 - gap, y, 4, INK), c(50 + gap, y, 4, INK)];
  if (smile) out.push(arc(50, y + 6, 8, 0.25 * Math.PI, 0.75 * Math.PI, INK, 3));
  return out;
}

/** 圆脑袋小动物：耳朵形状 + 配色就是它们彼此的区别 */
function critter(
  body: string,
  ears: "round" | "tall" | "point" | "flop" | "none",
  earColor: string,
  extra: Shape[] = []
): Shape[] {
  const out: Shape[] = [];
  if (ears === "round") out.push(c(28, 30, 12, earColor), c(72, 30, 12, earColor));
  if (ears === "tall") out.push(e(36, 20, 8, 20, earColor), e(64, 20, 8, 20, earColor));
  if (ears === "point") out.push(poly(earColor, 24, 34, 30, 8, 44, 26), poly(earColor, 76, 34, 70, 8, 56, 26));
  if (ears === "flop") out.push(e(24, 44, 9, 16, earColor), e(76, 44, 9, 16, earColor));
  out.push(c(50, 52, 32, body));
  out.push(...face(), ...extra);
  return out;
}

// ---------------------------------------------------------------------------
// 一、动物园
// ---------------------------------------------------------------------------

const ANIMALS: Icon[] = [
  { name: "花猫", shapes: critter("#F6C36B", "point", "#E5A73F", [line(INK, 3, 20, 56, 34, 58), line(INK, 3, 80, 56, 66, 58)]) },
  { name: "小狗", shapes: critter("#C98A5B", "flop", "#A96C40", [e(50, 62, 8, 6, INK)]) },
  { name: "小兔", shapes: critter("#F4E3EC", "tall", "#F0C6D8", [e(50, 62, 7, 5, "#E58BA8")]) },
  { name: "小熊", shapes: critter("#A9784F", "round", "#8C5F3B", [e(50, 64, 12, 9, "#E4C7A6"), c(50, 60, 4, INK)]) },
  { name: "小狐", shapes: critter("#EE9A5C", "point", "#D97B3C", [poly(WHITE, 34, 66, 66, 66, 50, 84)]) },
  { name: "青蛙", shapes: [c(30, 28, 12, "#8BC96B"), c(70, 28, 12, "#8BC96B"), c(30, 28, 5, INK), c(70, 28, 5, INK), c(50, 56, 30, "#8BC96B"), arc(50, 54, 16, 0.1 * Math.PI, 0.9 * Math.PI, INK, 3)] },
  { name: "小鸡", shapes: [c(50, 54, 30, "#FBE08A"), poly("#F2A23C", 44, 58, 56, 58, 50, 70), c(40, 46, 4, INK), c(60, 46, 4, INK), poly("#F2A23C", 40, 22, 50, 8, 60, 22)] },
  { name: "小猪", shapes: critter("#F4B5C4", "point", "#E795A8", [e(50, 62, 12, 9, "#E086A0"), c(45, 62, 3, INK), c(55, 62, 3, INK)]) },
  { name: "小鱼", shapes: [e(46, 52, 30, 20, "#6FC4E8"), poly("#4FA6CE", 74, 52, 94, 34, 94, 70), c(34, 46, 4, INK), arc(30, 58, 8, 1.7 * Math.PI, 0.3 * Math.PI, INK, 3)] },
  { name: "小鸟", shapes: [e(48, 54, 26, 22, "#8FB8F0"), poly("#F2A23C", 22, 52, 6, 58, 22, 62), c(58, 46, 4, INK), e(58, 62, 14, 9, "#6E97D6", -0.3)] },
  { name: "小龟", shapes: [c(74, 56, 12, "#9BD07E"), c(78, 52, 3, INK), c(46, 58, 30, "#6FA84E"), c(46, 58, 18, "#8CC46A"), line("#4C7C36", 3, 28, 58, 64, 58), line("#4C7C36", 3, 46, 40, 46, 76)] },
  { name: "小羊", shapes: [c(34, 40, 13, WHITE), c(66, 40, 13, WHITE), c(50, 32, 14, WHITE), c(50, 58, 27, "#F3EDE2"), ...face(54, 10)] },
];

// ---------------------------------------------------------------------------
// 二、水果摊
// ---------------------------------------------------------------------------

const FRUITS: Icon[] = [
  { name: "苹果", shapes: [c(50, 58, 30, "#E4605C"), box(47, 20, 6, 16, "#8A6034", 3), e(64, 26, 12, 7, "#77B860", -0.5)] },
  { name: "香蕉", shapes: [arc(50, 26, 40, 0.15 * Math.PI, 0.85 * Math.PI, "#F2CC46", 16), c(19, 39, 8, "#D9AE2E"), c(81, 39, 8, "#D9AE2E")] },
  { name: "葡萄", shapes: [c(36, 50, 12, "#9B72C8"), c(64, 50, 12, "#9B72C8"), c(50, 66, 12, "#8A5FBA"), c(50, 40, 12, "#A783D4"), box(47, 12, 6, 16, "#7A5A34", 3)] },
  { name: "草莓", shapes: [poly("#E4585F", 20, 42, 80, 42, 50, 88), c(50, 42, 30, "#E4585F"), poly("#5FA84C", 30, 30, 70, 30, 50, 44), c(40, 54, 3, WHITE), c(58, 62, 3, WHITE), c(50, 44, 3, WHITE)] },
  { name: "西瓜", shapes: [poly("#4E9B4A", 10, 30, 90, 30, 50, 90), poly("#EE6B72", 18, 38, 82, 38, 50, 82), c(42, 50, 3, INK), c(58, 54, 3, INK), c(50, 66, 3, INK)] },
  { name: "梨", shapes: [c(50, 64, 26, "#CBD86A"), c(50, 36, 18, "#CBD86A"), box(47, 12, 6, 14, "#7A5A34", 3), e(64, 22, 10, 6, "#77B860", -0.5)] },
  { name: "樱桃", shapes: [c(34, 68, 16, "#D64B58"), c(68, 68, 16, "#C23F4C"), line("#6E9B45", 4, 34, 52, 50, 20), line("#6E9B45", 4, 68, 52, 52, 20), e(62, 18, 12, 6, "#77B860", -0.4)] },
  { name: "柠檬", shapes: [e(50, 54, 32, 22, "#F2DB5C"), c(20, 54, 5, "#E0C43F"), c(80, 54, 5, "#E0C43F"), arc(50, 54, 16, 1.2 * Math.PI, 1.8 * Math.PI, "#E0C43F", 3)] },
  { name: "水蜜桃", shapes: [c(38, 58, 22, "#F5A0A8"), c(62, 58, 22, "#F19199"), line("#C7606A", 3, 50, 40, 50, 76), e(62, 24, 12, 7, "#77B860", -0.4)] },
  { name: "菠萝", shapes: [poly("#5FA84C", 50, 6, 38, 30, 62, 30), e(50, 62, 26, 30, "#EFC352"), line("#C79E36", 3, 28, 44, 72, 80), line("#C79E36", 3, 72, 44, 28, 80)] },
  { name: "橙子", shapes: [c(50, 56, 30, "#F09A3E"), c(50, 56, 22, "#F7BB6B"), line("#E08A2C", 3, 50, 34, 50, 78), line("#E08A2C", 3, 30, 56, 70, 56), box(47, 18, 6, 12, "#7A5A34", 3)] },
  { name: "蓝莓", shapes: [c(36, 58, 17, "#5B74BE"), c(66, 62, 15, "#4A62A8"), c(52, 38, 14, "#6C86CE"), c(36, 52, 5, "#93A6DC")] },
];

// ---------------------------------------------------------------------------
// 三、交通工具
// ---------------------------------------------------------------------------

const VEHICLES: Icon[] = [
  { name: "小汽车", shapes: [box(12, 50, 76, 24, "#E4695E", 10), box(28, 30, 44, 22, "#F0938A", 8), box(34, 34, 14, 14, "#CFE8F7", 3), box(54, 34, 14, 14, "#CFE8F7", 3), c(30, 76, 10, INK), c(70, 76, 10, INK)] },
  { name: "公交车", shapes: [box(10, 24, 80, 50, "#F0B93E", 10), box(18, 32, 20, 18, "#CFE8F7", 3), box(42, 32, 20, 18, "#CFE8F7", 3), box(66, 32, 16, 18, "#CFE8F7", 3), c(28, 78, 9, INK), c(72, 78, 9, INK)] },
  { name: "小火车", shapes: [box(8, 46, 46, 28, "#6C9BD8", 6), box(58, 32, 32, 42, "#4E7BB8", 8), box(64, 38, 20, 16, "#CFE8F7", 3), box(20, 18, 12, 28, "#4E7BB8", 4), c(20, 80, 8, INK), c(44, 80, 8, INK), c(74, 80, 8, INK)] },
  { name: "小轮船", shapes: [poly("#E4695E", 10, 60, 90, 60, 76, 84, 24, 84), box(30, 32, 40, 26, WHITE, 4), box(38, 38, 10, 10, "#CFE8F7", 2), box(54, 38, 10, 10, "#CFE8F7", 2), box(66, 14, 5, 20, "#4E7BB8", 2)] },
  { name: "帆船", shapes: [poly("#6C9BD8", 14, 66, 86, 66, 72, 84, 28, 84), line("#8A6034", 4, 50, 10, 50, 66), poly(WHITE, 50, 14, 50, 60, 18, 60), poly("#F0B93E", 54, 20, 54, 60, 82, 60)] },
  { name: "小飞机", shapes: [e(50, 52, 34, 12, "#DCE6F2"), poly("#9BB6D8", 40, 50, 62, 50, 46, 20), poly("#9BB6D8", 40, 54, 62, 54, 46, 84), poly("#6C9BD8", 78, 44, 92, 30, 92, 58), c(28, 50, 5, "#CFE8F7")] },
  { name: "热气球", shapes: [c(50, 42, 30, "#EE8AAE"), poly("#EE8AAE", 24, 54, 76, 54, 50, 78), line("#F0B93E", 3, 50, 12, 50, 72), box(40, 76, 20, 14, "#B07A46", 3), line(INK, 2, 40, 76, 44, 66), line(INK, 2, 60, 76, 56, 66)] },
  { name: "自行车", shapes: [arc(24, 66, 18, 0, 2 * Math.PI, "#4E7BB8", 4), arc(76, 66, 18, 0, 2 * Math.PI, "#4E7BB8", 4), line("#E4695E", 4, 24, 66, 46, 40, 66, 40, 76, 66), line("#E4695E", 4, 46, 40, 40, 66), line(INK, 4, 38, 34, 52, 34)] },
  { name: "小火箭", shapes: [poly("#E4695E", 50, 8, 68, 44, 32, 44), box(32, 44, 36, 30, "#F2F2F6", 6), c(50, 54, 9, "#7FC4E8"), poly("#E4695E", 32, 68, 18, 86, 32, 82), poly("#E4695E", 68, 68, 82, 86, 68, 82), poly("#F0B93E", 42, 80, 58, 80, 50, 94)] },
  { name: "大卡车", shapes: [box(8, 34, 46, 40, "#77B860", 6), box(56, 46, 36, 28, "#5FA84C", 6), box(62, 50, 16, 14, "#CFE8F7", 3), c(24, 78, 9, INK), c(74, 78, 9, INK)] },
  { name: "消防车", shapes: [box(8, 40, 84, 34, "#D9483F", 8), box(16, 46, 22, 18, "#CFE8F7", 3), line("#B0B6C4", 5, 44, 44, 88, 22), c(26, 78, 9, INK), c(72, 78, 9, INK), c(78, 32, 7, "#F0B93E")] },
  { name: "缆车", shapes: [line("#8A93A6", 3, 6, 18, 94, 18), line("#8A93A6", 4, 50, 18, 50, 34), box(26, 34, 48, 40, "#EE8AAE", 8), box(34, 42, 14, 16, "#CFE8F7", 3), box(52, 42, 14, 16, "#CFE8F7", 3)] },
];

// ---------------------------------------------------------------------------
// 四、乐器架
// ---------------------------------------------------------------------------

const INSTRUMENTS: Icon[] = [
  { name: "小鼓", shapes: [box(18, 38, 64, 36, "#E4695E", 6), e(50, 38, 32, 10, "#F5EDE0"), line("#F0B93E", 3, 18, 44, 82, 68), line("#F0B93E", 3, 82, 44, 18, 68), line("#8A6034", 4, 74, 20, 90, 8), c(74, 20, 5, "#8A6034")] },
  { name: "铃鼓", shapes: [arc(50, 54, 30, 0, 2 * Math.PI, "#C98A5B", 8), c(50, 54, 24, "#F5EDE0"), c(50, 22, 6, "#F0B93E"), c(22, 66, 6, "#F0B93E"), c(78, 66, 6, "#F0B93E")] },
  { name: "三角铁", shapes: [line("#C0C6D2", 6, 50, 16, 84, 78, 22, 78, 46, 22), line("#8A6034", 4, 62, 44, 88, 30)] },
  { name: "沙锤", shapes: [c(34, 34, 20, "#F0B93E"), box(38, 50, 8, 36, "#8A6034", 4), c(74, 52, 14, "#EE8AAE"), box(76, 64, 6, 24, "#8A6034", 3)] },
  { name: "木琴", shapes: [box(14, 26, 16, 56, "#E4695E", 4), box(34, 32, 16, 46, "#F0B93E", 4), box(54, 38, 16, 36, "#77B860", 4), box(74, 44, 14, 26, "#6C9BD8", 4)] },
  { name: "小喇叭", shapes: [poly("#F0B93E", 74, 26, 92, 16, 92, 84, 74, 74), box(20, 40, 56, 20, "#E0A82E", 6), c(30, 34, 6, "#C79226"), c(46, 34, 6, "#C79226"), c(62, 34, 6, "#C79226")] },
  { name: "长笛", shapes: [box(10, 44, 80, 14, "#C0C6D2", 7), c(26, 51, 4, INK), c(42, 51, 4, INK), c(58, 51, 4, INK), c(74, 51, 4, INK)] },
  { name: "小吉他", shapes: [c(46, 62, 24, "#C98A5B"), c(46, 38, 18, "#C98A5B"), c(46, 58, 9, "#5C3E22"), box(44, 6, 6, 30, "#8A6034", 3), line("#F5EDE0", 2, 46, 12, 46, 80)] },
  { name: "钢琴键", shapes: [box(10, 26, 80, 52, WHITE, 4), line(INK, 2, 30, 26, 30, 78), line(INK, 2, 50, 26, 50, 78), line(INK, 2, 70, 26, 70, 78), box(22, 26, 12, 30, INK, 2), box(42, 26, 12, 30, INK, 2), box(62, 26, 12, 30, INK, 2)] },
  { name: "小竖琴", shapes: [arc(56, 52, 34, 1.15 * Math.PI, 1.85 * Math.PI, "#C98A5B", 8), line("#8A6034", 6, 26, 22, 26, 84), line("#F0B93E", 2, 34, 30, 34, 80), line("#F0B93E", 2, 46, 24, 46, 78), line("#F0B93E", 2, 58, 24, 58, 76)] },
  { name: "口琴", shapes: [box(10, 38, 80, 26, "#C0C6D2", 5), box(16, 44, 68, 14, "#8A93A6", 3), line(WHITE, 2, 28, 44, 28, 58), line(WHITE, 2, 40, 44, 40, 58), line(WHITE, 2, 52, 44, 52, 58), line(WHITE, 2, 64, 44, 64, 58), line(WHITE, 2, 76, 44, 76, 58)] },
  { name: "小铃铛", shapes: [box(46, 12, 8, 12, "#C0C6D2", 3), poly("#F0B93E", 50, 20, 82, 66, 18, 66), box(14, 64, 72, 10, "#E0A82E", 5), c(50, 82, 8, "#E0A82E")] },
];

// ---------------------------------------------------------------------------
// 五、天气窗
// ---------------------------------------------------------------------------

const WEATHER: Icon[] = [
  { name: "太阳", shapes: [c(50, 50, 24, "#F5C33B"), line("#F0A62E", 4, 50, 8, 50, 20), line("#F0A62E", 4, 50, 80, 50, 92), line("#F0A62E", 4, 8, 50, 20, 50), line("#F0A62E", 4, 80, 50, 92, 50), line("#F0A62E", 4, 20, 20, 29, 29), line("#F0A62E", 4, 80, 80, 71, 71), line("#F0A62E", 4, 20, 80, 29, 71), line("#F0A62E", 4, 80, 20, 71, 29)] },
  { name: "月亮", shapes: [c(54, 50, 32, "#F5E27E"), c(72, 38, 26, "#FFFDF2"), c(24, 22, 4, "#F5C33B"), c(18, 74, 3, "#F5C33B")] },
  { name: "白云", shapes: [c(34, 58, 18, WHITE), c(56, 52, 24, WHITE), c(74, 62, 15, WHITE), box(30, 60, 48, 16, WHITE, 8)] },
  { name: "下雨", shapes: [c(36, 38, 16, "#B8C6D8"), c(58, 34, 20, "#B8C6D8"), box(30, 40, 44, 14, "#B8C6D8", 7), line("#6C9BD8", 4, 34, 62, 28, 80), line("#6C9BD8", 4, 52, 62, 46, 80), line("#6C9BD8", 4, 70, 62, 64, 80)] },
  { name: "雪花", shapes: [line("#7FC4E8", 4, 50, 12, 50, 88), line("#7FC4E8", 4, 17, 31, 83, 69), line("#7FC4E8", 4, 17, 69, 83, 31), c(50, 50, 7, "#CFE8F7"), c(50, 16, 4, "#7FC4E8"), c(50, 84, 4, "#7FC4E8")] },
  { name: "彩虹", shapes: [arc(50, 78, 40, Math.PI, 2 * Math.PI, "#E4695E", 8), arc(50, 78, 32, Math.PI, 2 * Math.PI, "#F0B93E", 8), arc(50, 78, 24, Math.PI, 2 * Math.PI, "#77B860", 8), arc(50, 78, 16, Math.PI, 2 * Math.PI, "#6C9BD8", 8)] },
  { name: "闪电", shapes: [c(36, 32, 16, "#9AA6B8"), c(60, 28, 19, "#9AA6B8"), box(30, 34, 44, 12, "#9AA6B8", 6), poly("#F5C33B", 54, 48, 34, 78, 48, 78, 40, 94, 66, 62, 52, 62)] },
  { name: "起风", shapes: [arc(38, 32, 14, 1.5 * Math.PI, 1.1 * Math.PI, "#8FB8C8", 5), line("#8FB8C8", 5, 10, 46, 66, 46), arc(56, 60, 12, 1.5 * Math.PI, 1.1 * Math.PI, "#8FB8C8", 5), line("#8FB8C8", 5, 16, 74, 58, 74)] },
  { name: "起雾", shapes: [box(12, 30, 76, 10, "#C6D2DE", 5), box(22, 48, 66, 10, "#D6DEE8", 5), box(12, 66, 60, 10, "#C6D2DE", 5), c(70, 20, 12, "#F5E9C8")] },
  { name: "露珠", shapes: [poly("#7FC4E8", 50, 12, 78, 58, 22, 58), c(50, 58, 28, "#7FC4E8"), c(40, 52, 7, "#CFE8F7"), line("#5FA84C", 4, 8, 86, 92, 86)] },
  { name: "小星星", shapes: [poly("#F5C33B", 50, 8, 61, 38, 93, 38, 67, 57, 77, 88, 50, 69, 23, 88, 33, 57, 7, 38, 39, 38), c(50, 50, 6, "#FFF3C8")] },
  { name: "冰晶", shapes: [poly("#7FC4E8", 50, 10, 84, 30, 84, 70, 50, 90, 16, 70, 16, 30), poly("#CFE8F7", 50, 26, 70, 38, 70, 62, 50, 74, 30, 62, 30, 38), c(50, 50, 6, WHITE)] },
];

// ---------------------------------------------------------------------------
// 六、朵朵一家（本作原创角色）
// ---------------------------------------------------------------------------

/** 一个小人：头发形状 + 衣服颜色区分谁是谁 */
function person(hair: string, cloth: string, hairTop: "bun" | "long" | "short" | "cap"): Shape[] {
  const out: Shape[] = [];
  out.push(poly(cloth, 22, 92, 78, 92, 70, 62, 30, 62));
  out.push(c(50, 42, 26, "#F7DCC4"));
  if (hairTop === "bun") out.push(c(50, 14, 11, hair), box(24, 20, 52, 16, hair, 8));
  if (hairTop === "long") out.push(box(22, 24, 56, 44, hair, 20), c(50, 24, 28, hair), c(50, 42, 22, "#F7DCC4"));
  if (hairTop === "short") out.push(arc(50, 30, 26, Math.PI, 2 * Math.PI, hair, 14));
  if (hairTop === "cap") out.push(arc(50, 30, 26, Math.PI, 2 * Math.PI, hair, 14), box(18, 26, 64, 7, hair, 3));
  out.push(c(41, 44, 3.5, INK), c(59, 44, 3.5, INK));
  out.push(arc(50, 50, 7, 0.2 * Math.PI, 0.8 * Math.PI, INK, 2.5));
  return out;
}

const FAMILY: Icon[] = [
  { name: "朵朵", shapes: [...person("#5C4630", "#F58FB0", "bun"), c(30, 16, 7, "#F5C33B")] },
  { name: "星星", shapes: [...person("#3E3A52", "#7FC4E8", "short"), poly("#F5C33B", 74, 8, 79, 20, 92, 20, 82, 28, 86, 40, 74, 33, 62, 40, 66, 28, 56, 20, 69, 20)] },
  { name: "妈妈", shapes: person("#4A3826", "#C98AD8", "long") },
  { name: "爸爸", shapes: person("#2F2A20", "#6C9BD8", "cap") },
  { name: "小弟弟", shapes: [poly("#8FD07A", 26, 92, 74, 92, 68, 66, 32, 66), c(50, 46, 24, "#F7DCC4"), arc(50, 36, 24, Math.PI, 2 * Math.PI, "#6B5236", 12), c(42, 48, 3.5, INK), c(58, 48, 3.5, INK), c(50, 58, 4, "#E58BA8")] },
  { name: "奶奶", shapes: [...person("#C8C4BC", "#F0B93E", "bun"), arc(41, 44, 8, 0, 2 * Math.PI, INK, 2), arc(59, 44, 8, 0, 2 * Math.PI, INK, 2), line(INK, 2, 49, 44, 51, 44)] },
  { name: "小狗豆豆", shapes: critter("#E0B57C", "flop", "#C2905A", [e(50, 62, 9, 6, INK), box(30, 78, 40, 8, "#E4695E", 4)]) },
  { name: "小猫团团", shapes: critter("#B8B4C8", "point", "#9A96AC", [line(INK, 3, 18, 56, 34, 58), line(INK, 3, 82, 56, 66, 58), c(50, 78, 6, "#F5C33B")]) },
  { name: "小屋", shapes: [poly("#E4695E", 50, 8, 92, 44, 8, 44), box(18, 44, 64, 46, "#F5E9D0", 4), box(42, 60, 20, 30, "#C98A5B", 3), box(24, 52, 14, 14, "#7FC4E8", 2), box(66, 52, 12, 12, "#7FC4E8", 2)] },
  { name: "小花", shapes: [c(50, 30, 14, "#F58FB0"), c(30, 46, 14, "#F58FB0"), c(70, 46, 14, "#F58FB0"), c(38, 66, 14, "#F58FB0"), c(62, 66, 14, "#F58FB0"), c(50, 48, 12, "#F5C33B"), line("#5FA84C", 4, 50, 62, 50, 94)] },
  { name: "气球", shapes: [c(50, 40, 28, "#F58FB0"), poly("#F58FB0", 44, 66, 56, 66, 50, 76), line("#8A93A6", 2, 50, 74, 56, 96), c(40, 32, 7, "#FBC4D6")] },
  { name: "小蛋糕", shapes: [box(16, 50, 68, 36, "#F7DCC4", 6), box(16, 50, 68, 12, "#F58FB0", 6), line("#F5C33B", 4, 50, 24, 50, 48), poly("#E4695E", 50, 10, 55, 22, 45, 22), c(30, 70, 4, "#7FC4E8"), c(50, 74, 4, "#77B860"), c(70, 70, 4, "#F5C33B")] },
];

// ---------------------------------------------------------------------------

export const THEME_PACKS: ThemePack[] = [
  { id: "animals", name: "动物园", back: "#FFE0C7", icons: ANIMALS },
  { id: "fruits", name: "水果摊", back: "#FFDCDC", icons: FRUITS },
  { id: "vehicles", name: "交通工具", back: "#D6EBFF", icons: VEHICLES },
  { id: "instruments", name: "乐器架", back: "#FFF0C9", icons: INSTRUMENTS },
  { id: "weather", name: "天气窗", back: "#E2F0F7", icons: WEATHER },
  { id: "family", name: "朵朵一家", back: "#F3D9FF", icons: FAMILY },
];

/** 每套至少这么多个图案 */
export const MIN_ICONS_PER_PACK = 12;

/** 第 theme 号关卡该用哪一套图案（十章轮着用六套，编号超了也不会越界） */
export function packForTheme(theme: number): ThemePack {
  const n = Math.max(0, Math.floor(theme));
  return THEME_PACKS[n % THEME_PACKS.length];
}

/** 一个 2D 上下文长什么样（只用得到这几件事，方便单测拿假上下文验一遍） */
export interface IconCtx {
  save: () => void;
  restore: () => void;
  translate: (x: number, y: number) => void;
  scale: (x: number, y: number) => void;
  rotate: (a: number) => void;
  beginPath: () => void;
  closePath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arc: (x: number, y: number, r: number, from: number, to: number) => void;
  ellipse: (x: number, y: number, rx: number, ry: number, rot: number, from: number, to: number) => void;
  roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  rect: (x: number, y: number, w: number, h: number) => void;
  fill: () => void;
  stroke: () => void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  lineCap: CanvasLineCap;
}

/** 把一个图案画进 size×size 的方格里（图案本身是画在 0..100 的框里的） */
export function drawIcon(ctx: IconCtx, icon: Icon, size: number): void {
  const k = size / 100;
  ctx.save();
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const s of icon.shapes) {
    switch (s.t) {
      case "c":
        ctx.fillStyle = s.f;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "e":
        ctx.fillStyle = s.f;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.rx, s.ry, s.a ?? 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "r":
        ctx.fillStyle = s.f;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(s.x, s.y, s.w, s.h, s.rd ?? 0);
        else ctx.rect(s.x, s.y, s.w, s.h);
        ctx.fill();
        break;
      case "p":
        ctx.fillStyle = s.f;
        ctx.beginPath();
        for (let i = 0; i + 1 < s.pts.length; i += 2) {
          if (i === 0) ctx.moveTo(s.pts[0], s.pts[1]);
          else ctx.lineTo(s.pts[i], s.pts[i + 1]);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case "l":
        ctx.strokeStyle = s.s;
        ctx.lineWidth = s.w;
        ctx.beginPath();
        for (let i = 0; i + 1 < s.pts.length; i += 2) {
          if (i === 0) ctx.moveTo(s.pts[0], s.pts[1]);
          else ctx.lineTo(s.pts[i], s.pts[i + 1]);
        }
        ctx.stroke();
        break;
      default:
        ctx.strokeStyle = s.s;
        ctx.lineWidth = s.w;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, s.from, s.to);
        ctx.stroke();
        break;
    }
  }
  ctx.restore();
}
