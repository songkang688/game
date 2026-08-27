/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "mole-pop",
  title: "地鼠嘭嘭",
  emoji: "🐹",
  category: "casual" as const,
  color: "#EBDFC8",
  blurb: "188 关十大地洞！谱面打点分 Perfect / Good / 擦边，帽子鼠、闪光鼠、群鼠齐上，还有无尽地鼠夜市！",
  // levels.ts 的 10 章合计 188 关,外加无尽地鼠夜市
  modes: ["campaign", "endless"] as const,
  // 全程点触,手机 / 平板最顺手(桌面用鼠标点也能玩)
  platform: "mobile" as const,
  levels: 188,
};
