/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "ice-fire-forest",
  title: "冰冰火火森林",
  emoji: "❄️",
  category: "action" as const,
  color: "#DCEAF6",
  blurb: "凛凛怕岩浆、焰焰怕冰水,两人合力闯 188 关机关森林;一个人玩按 Tab 换角色。",
  // levels.ts 八章合计 188 关;index.ts 可切单人 Tab 换人或双人两套键位,没有无尽
  modes: ["campaign", "coop", "twoPlayer"] as const,
  levels: 188,
};
