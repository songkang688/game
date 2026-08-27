/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "pinyin-train",
  title: "拼音小火车",
  emoji: "🚂",
  category: "edu" as const,
  color: "#74c0fc",
  blurb: "十一座车站 188 关！认声母韵母、标声调、拖车厢拼音节，还要过易混淆专项和句子注音！",
  // 11 章合计 188 关,只有闯关一种玩法
  modes: ["campaign"] as const,
  // 触屏拖车厢与键盘 Tab 逐个点选都能玩,手游端游通吃
  platform: "both" as const,
  levels: 188,
};
