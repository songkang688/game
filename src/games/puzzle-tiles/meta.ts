/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "puzzle-tiles",
  title: "拼图乐园",
  emoji: "🧩",
  category: "casual" as const,
  color: "#E5E9FF",
  blurb: "188 关十本画册！拼块带纸纹齿边像真拼图，大画板、旋转块、拖着碎片磁性吸附，预览三档随你挑，还有无尽画廊！",
  // levels.ts 的 10 章合计 188 关,外加无尽画廊
  modes: ["campaign", "endless"] as const,
  // 拖碎片手指最顺,鼠标拖也是同一套吸附判定
  platform: "both" as const,
  levels: 188,
};
