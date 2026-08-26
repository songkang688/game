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
  blurb: "上下半场同时开抢!三回合点点大战,三张擂台、三个温和技能,还能一个人挑战电脑四档、守擂连胜。",
  // 没有闯关地图,只有回合制的同屏擂台,所以不填 levels。
  // 1.2 结论:纯反应对战硬凑 188 关会变成「同一局重复 188 遍」的注水,本款明确不做 campaign;
  // 平台的「直达第 N 关」由 arena12.ts 的 levelToArenaSetup() 映射成「人机档 + 擂台」。
  // 1.2 补:单人 vs 人机(四档)与「守擂无尽」,所以 modes 加上 endless。
  // 实测平台:both(手指点最顺,鼠标也一样点得到)——
  // platform 字段属于 1.2 第 1 步 B 档的 src/engine/types.ts,等它合进来再落这一行。
  modes: ["versus", "endless", "twoPlayer"] as const,
};
