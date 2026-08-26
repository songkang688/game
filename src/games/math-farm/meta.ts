/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "math-farm",
  title: "算数小农场",
  emoji: "🐮",
  category: "edu" as const,
  color: "#8ce99a",
  blurb:
    "十大农场 188 关!数一数、竖式进退位、分数通分、小数四则、百分数与折扣、比与比例、简单方程,还有农场应用题和找规律。",
  // 10 章合计 188 关;学习类只做闯关,不做对战与无尽——竖式和通分要的是算准,不是抢答
  modes: ["campaign"] as const,
  levels: 188,
  // 选项按钮够大,手机点得准;电脑上键盘也能选
  platform: "both" as const,
};
