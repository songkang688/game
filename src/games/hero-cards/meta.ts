/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "hero-cards",
  title: "英杰令",
  emoji: "🎴",
  category: "party" as const,
  color: "#FFD9C8",
  blurb: "亮出花主,藏起身份。算好距离、用对技能,让对桌的伙伴自己露出马脚。",
  // 五人身份场:188 关残局战役 + 一人对四机对战 + 连胜无尽,全程离线。
  // 不做双人同屏 —— 身份场靠隐藏身份撑着,两个人挤一块屏会互相看光手牌与身份。
  modes: ["campaign", "versus", "endless"] as const,
  levels: 188,
  platform: "mobile" as const
};
