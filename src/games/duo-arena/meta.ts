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
  blurb: "上下半场同时开抢!走位收元气,三局两胜,四张擂台轮换,人机四档还能无尽守擂。",
  // 没有 188 关战役:这是纯对战玩法,硬凑 188 关只会变成同一个回合重复 188 遍(注水),
  // 所以不填 levels。平台的 ?level=N 直达仍然接住,映射成「人机档 + 场地」,见 match.ts 的 levelToSetup。
  modes: ["versus", "twoPlayer", "endless"] as const,
  // 键盘双人同屏与手机摇杆两套控件都做了,手游端游都能玩
  platform: "both" as const,
};
