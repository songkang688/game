/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "bomb-buddies",
  // 1.3 窗口 5:原名内嵌某商业游戏的通行中文名(tester 报告 Z1 记阻断),
  // 更名为原创的「泡泡布阵」——摆泡泡、布阵型,正是这款的玩法本体。
  title: "泡泡布阵",
  emoji: "🫧",
  category: "action" as const,
  color: "#e6f0ff",
  blurb: "格子迷宫里摆泡泡!188 关八大主题清怪找出口,还能双人对战、三档人机、一层一图的无尽泡泡塔,以及被罩住时队友拍破救人的双人合作。",
  // levels.ts 的 CHAPTERS 八章合计 188 关;index.ts 的模式条另有对战 / 人机 / 泡泡塔 / 合作
  modes: ["campaign", "versus", "endless", "coop", "twoPlayer"] as const,
  levels: 188,
  // 实测:键盘两套键位齐全(朵朵 WASD+F/V/G、星星 方向键+L/J/K),手机每人一根摇杆
  // 加放泡 / 踢泡 / 拍破三颗 44px 钮;375×667 与 360×720 两个视口上
  // 五种模式的控件都落在舞台内、互不重叠,最大的 13×13 地图每格仍有 24px → both。
  platform: "both" as const,
};
