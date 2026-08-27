/**
 * 纯数据 meta：首页 eager 收集本文件渲染卡片，玩法代码留在 index.ts 按需加载。
 * 不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "duo-vs-star",
  title: "鸭梨大战康康",
  emoji: "💥",
  category: "party" as const,
  color: "#ffd0e4",
  blurb:
    "十二位好朋友的弹飞大混战！轻击把对手的元气磨下去，再一记重击送出场外——双人同屏、人机混战、2v2 合作、无尽车轮战和 188 关全都有。",
  // index.ts 六个入口:双人对战 / 人机混战 / 2v2 团队赛 / 合作特训 3 课 / 无尽车轮战 / 188 关闯关。
  // 1.2 平衡过一轮:12 位角色的循环赛总胜率全部落在 44%-56%(见 balance12.test.ts),
  // 击退曲线封顶且低元气有 0.4 秒挣扎窗口,道具刷新左右镜像、强道具改成蓄力才生效,
  // 战役后段改成加行为(绕后 / 抢道具 / 等你收招 / 边缘守门留缝)而不是加数值。
  modes: ["campaign", "versus", "endless", "coop", "twoPlayer"] as const,
  // 键盘两套键位齐全,手机每人一组触屏按键(含配合键),两边都实测过
  platform: "both" as const,
  levels: 188,
};
