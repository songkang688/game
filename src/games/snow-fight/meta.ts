/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "snow-fight",
  title: "雪球大作战",
  emoji: "⛄",
  category: "party" as const,
  color: "#e3f0fd",
  blurb:
    "实时的躲—搓—投:蹲下搓雪球(手里最多三颗),站起来按住蓄力,落点圈套住靶子再松手。雪墙砸得碎、木箱推得动、雪坡蹲下才藏得住;被砸中只是变 1.5 秒雪人。",
  // 8 章合计 188 关;index.ts 的模式条有双人对战、人机对战(三档)与无尽雪季
  modes: ["campaign", "versus", "twoPlayer", "endless"] as const,
  levels: 188,
  // 实测:手机 360px 一根手指按住画面蓄力、上下拖调准星、松手扔出去;桌面两套键位同屏双人
  platform: "both" as const,
};
