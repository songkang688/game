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
  blurb: "十大王国区域 188 关！认形状、周长面积、对称旋转、立体展开还有坐标方位！",
  // 10 章合计 188 关(blurb 里的「99」是 1.0 遗留文案,归 B 改),只有闯关
  modes: ["campaign"] as const,
  levels: 188,
};
