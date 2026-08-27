/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "bubble-pop",
  title: "泡泡噗噗",
  emoji: "🫧",
  category: "casual" as const,
  color: "#DCF3FF",
  blurb: "188 关十大主题！按住先看这一团值多少分,连锁泡炸开一圈,没得消就吹口气重排,还有无尽泡泡海!",
  // 10 章合计 188 关,外加无尽泡泡海
  modes: ["campaign", "endless"] as const,
  // 手指按住预览、抬手才消,手机最顺;桌面用鼠标悬停预览同样完整
  platform: "both" as const,
  levels: 188,
};
