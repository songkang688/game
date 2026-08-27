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
  blurb: "俯视格子战场:砖墙打一角掉一角、钢板得换彩纸穿甲弹、水面绕着走、草丛藏身形、冰面刹不住。弹力球还能拐弯打人。188 关守住星星老巢,另有双人合作、双人对战(可叫电脑陪练)和无尽守巢。",
  // 8 章合计 188 关;index.ts 的模式条有双人合作、双人对战与无尽守老巢
  modes: ["campaign", "coop", "versus", "endless"] as const,
  levels: 188,
  // 键盘(WASD / 方向键)与触屏摇杆两套都实测过:375×667、360×720 上摇杆与发射钮不重叠
  platform: "both" as const,
};
