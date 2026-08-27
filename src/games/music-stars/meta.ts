/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "music-stars",
  title: "音乐星星",
  emoji: "🌟",
  category: "create" as const,
  color: "#ffe066",
  blurb: "十场音乐会 188 关！跟弹旋律、跟着拍子敲节奏、听辨音程、两根手指弹双声部、照着简谱视奏,还能进自由弹奏台自己作曲录三十秒!",
  // 10 章合计 188 关,只有闯关;另有一个不计分的自由弹奏沙盒入口,不算 mode
  modes: ["campaign"] as const,
  // 星星热区 56px 起,五颗在 360px 下一行排得开;双声部要两根手指同时按,
  // 触屏最顺手,鼠标与键盘也能一颗一颗点下去,手游端游通吃
  platform: "both" as const,
  levels: 188,
};
