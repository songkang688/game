/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "shape-kingdom",
  title: "形状王国",
  emoji: "🏰",
  category: "edu" as const,
  color: "#b197fc",
  blurb: "十大王国区域 188 关！认形状数边、算周长面积、数对称轴转图案、认立体展开图、读坐标走方位，还能自己动手画图形、补对称、拼骨牌！",
  // 10 章合计 188 关,只有闯关;后 4 章按「单步→两步→三步」推理递进,并夹了三类动手作图关
  modes: ["campaign"] as const,
  // 作图题拖点吸附是触屏优先,同一套点阵也能用键盘方向键逐格挪,手游端游通吃
  platform: "both" as const,
  levels: 188,
};
