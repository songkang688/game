/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "bowling-lane",
  title: "保龄球小馆",
  emoji: "🎳",
  category: "casual" as const,
  color: "#e8f1ff",
  blurb: "蓄力、落点、旋转三下定一球,每一段都能反悔重来。球道是近大远小的斜视角,十个瓶真的会连锁着倒。188 关八章各有花样:护栏、移动瓶、分瓶、限球数,另有双人轮流投和一档比一档难的无尽格。",
  // levels.ts 的 CHAPTERS 八章合计 188 关;index.ts 的模式条另有双人对战 / 无尽
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
};
