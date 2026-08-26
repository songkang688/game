/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "duo-arena",
  title: "朵星擂台",
  emoji: "🥊",
  category: "party" as const,
  color: "#FFE3D0",
  blurb: "上下半场同时开抢！三回合点点大战，金币礼物加炸弹，先赢两回合称王！",
  // 没有闯关地图,只有一局定胜负的双人同屏擂台,所以不填 levels
  modes: ["versus", "twoPlayer"] as const,
};
