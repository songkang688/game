/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "duo-rush",
  title: "朵星双人冲刺",
  emoji: "🏃",
  category: "party" as const,
  color: "#CDE9FF",
  blurb: "2.5D 分屏竞速!朵朵星星各控三车道,无尽、抢金币、幽灵配速和人机四档都能跑。",
  // index.ts:2.5D 分屏无尽竞速 / 抢金币 / 幽灵对战 / 人机四档,没有闯关地图。
  // 1.2 结论:双人竞速做 188 关会退化成刷图,跑酷闯关归 rainbow-run,本款明确不做 campaign;
  // 平台的「直达第 N 关」由 rush12.ts 的 levelToSetup() 映射成「赛道难度档 + 人机档」。
  // 实测平台:both(键盘双人顺手,上下分屏触屏双人也完整可玩)——
  // platform 字段属于 1.2 第 1 步 B 档的 src/engine/types.ts,等它合进来再落这一行。
  modes: ["versus", "endless", "twoPlayer"] as const,
};
