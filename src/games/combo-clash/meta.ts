/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不许 import 任何玩法代码。
 */
export const meta = {
  id: "combo-clash",
  title: "连招对决",
  emoji: "💫",
  category: "party" as const,
  color: "#FFD6EA",
  blurb: "跳过去接一串连招,再取消成超必杀!看元气、看硬直,把对手打到坐下休息。",
  // 188 关挑战塔 + 四档人机 BO3 + 连胜无尽 + 同屏双人 + 训练场,全程离线本机对局
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  platform: "desktop" as const
};
