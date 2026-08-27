/**
 * 纯数据 meta：首页 eager 收集本文件渲染卡片，玩法代码留在 index.ts 按需加载。
 * 这里不许 import 任何玩法代码。
 */
export const meta = {
  id: "fight-king",
  title: "朵星格斗王",
  emoji: "🥋",
  category: "party" as const,
  color: "#FFDCE8",
  blurb: "八位小伙伴同台切磋！三段招式连成串，能量满槽放超必杀；人机五档、188 关格斗塔、无尽连胜，还有会报帧数的训练场！",
  // index.ts 五种模式:双人对战 / 人机 / 格斗塔 188 / 无尽连胜 / 训练(训练不算独立玩法芯片)
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  levels: 188,
  // 键盘两套键位、手机左右半屏各一套摇杆 + 轻/重/必杀/防御四钮,两边都实测能打
  platform: "both" as const,
};
