/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "kitty-care",
  title: "萌猫小屋",
  emoji: "🐱",
  category: "casual" as const,
  color: "#f7a23b",
  blurb:
    "十大主题 188 关照顾小猫！喂饭、逗猫、搓泡泡、哄睡、打扮、看病、搭配七种手感各不相同,还有照顾马拉松和 24 件小屋相册等你收集。",
  // 10 章合计 188 关:闯关 + 照顾马拉松(无尽);对战不做
  modes: ["campaign", "endless"] as const,
  // 拖拽 / 搓泡泡 / 逗猫棒都是触屏优先,鼠标与键盘也各有等价操作,手游端游通吃
  platform: "both" as const,
  levels: 188,
};
