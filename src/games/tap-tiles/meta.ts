/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "tap-tiles",
  title: "音符下落",
  emoji: "🎹",
  category: "casual" as const,
  color: "#E8D9FF",
  blurb: "音符块落下来就点,空白格千万别碰。连击越高越好听,四条轨都是你的琴键。",
  // index.ts 四种入口:188 关闯关 / 同谱对战 / 无尽加速 / 双人分轨
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  // 手机点四列就能玩,电脑上是 D F J K 四个键,两个平台都上
  platform: "both" as const,
};
