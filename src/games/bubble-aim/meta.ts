/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "bubble-aim",
  title: "泡泡瞄准手",
  emoji: "🫧",
  category: "casual" as const,
  color: "#D9EFFF",
  blurb: "188 关 9 大主题世界:石泡、彩虹、炸弹、黑洞、云挡板与下压顶板。拖着瞄准线微调角度,打散的泡泡会一路掉下去;还有顶不完的无尽墙。",
  // levels.ts 的 THEME_SIZES 合计 188 关(自带存档,没走 188 关通用框架);地图上另有无尽墙
  modes: ["campaign", "endless"] as const,
  // 拖动瞄准 + 🔀 换弹钮是触屏原生手感,键盘 Tab 换弹等价 —— 两边都能玩
  platform: "both" as const,
  levels: 188,
};
