/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "red-blue-tug",
  title: "红蓝拔河",
  emoji: "🪢",
  category: "party" as const,
  color: "#ff6b6b",
  blurb: "188 关十大赛场！按住蓄力、松手换气，踩着加油点猛拉一把；四档小电脑、同屏双人，还有拉不完的绳！",
  // 10 章合计 188 关;对战可选四档小电脑或同屏双人(左右两侧各一个大按钮),另有「拉不完的绳」无尽连胜
  modes: ["campaign", "versus", "endless"] as const,
  levels: 188,
};
