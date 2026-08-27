/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容从 index.ts 原样搬出,请保持与游戏实现一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "duo-rush",
  title: "梨康双人冲刺",
  emoji: "🏃",
  category: "party" as const,
  color: "#CDE9FF",
  blurb: "2.5D 分屏竞速!鸭梨康康各控三车道,道具、中途分岔、幽灵配速和人机四档都能跑。",
  // index.ts:2.5D 分屏无尽竞速 / 道具竞速 / 抢金币 / 幽灵对战 / 人机四档,没有闯关地图。
  // 1.2 结论:双人竞速做 188 关会退化成刷图,跑酷闯关归 rainbow-run,本款明确不做 campaign;
  // 平台的「直达第 N 关」由 rush12.ts 的 levelToSetup() 映射成「赛道难度档 + 人机档」。
  modes: ["versus", "endless", "twoPlayer"] as const,
  // 实测:键盘双人最顺手,但上下分屏 + 每半屏两颗 44px 触屏按钮,手机上两个人也完整可玩 → both。
  // 字段是 1.2 第 1 步 B 档给 GameMeta 加的可选项,缺省当 both,先填这里不影响老平台。
  platform: "both" as const,
};
