/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "tank-battle",
  title: "铁皮坦克大战",
  emoji: "🚜",
  category: "action" as const,
  color: "#dfeed4",
  blurb: "俯视格子战场:砖墙打得碎、钢墙打不动、水面绕着走、草丛藏身形。188 关守住星星堡垒,还能双人合作、双人对战和无尽敌潮。",
  // 8 章合计 188 关;index.ts 的模式条有双人合作、双人对战与无尽敌潮
  modes: ["campaign", "coop", "versus", "endless"] as const,
  levels: 188,
};
