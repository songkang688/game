/**
 * 红蓝拔河 · 99 关关卡表。
 * 六个主题赛场、四种拔河机关（并非同一模板）：
 *  ①草地拔河=纯拼力气  ②加油星=抢星星猛拉一把  ③红灯绿灯=红灯拉绳会打滑
 *  ④节奏鼓点=左右手交替才有力  ⑤大力士挑战=星星+更强电脑  ⑥冠军之路=全机关混合
 */
import type { Chapter } from "../level99";

export interface TugLevel {
  /** 小电脑每秒拉走多少（0..100 为胜负线） */
  aiRate: number;
  /** 你每次点击拉回多少 */
  pullPower: number;
  /** 会出现加油星 */
  star: boolean;
  /** 有红灯绿灯裁判 */
  redlight: boolean;
  /** 需要左右手交替 */
  rhythm: boolean;
  theme: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "草地拔河", emoji: "🌿", color: "#E2F7DF", desc: "狂点按钮，把绳子拉过来！", size: 17 },
  { name: "加油星", emoji: "⭐", color: "#FFF3C4", desc: "加油星一闪就去抢，猛拉一大把！", size: 17 },
  { name: "红灯绿灯", emoji: "🚦", color: "#FFE0E0", desc: "红灯拉绳会打滑，看准绿灯再用力！", size: 17 },
  { name: "节奏鼓点", emoji: "🥁", color: "#FFE9D6", desc: "左手右手轮着拉，节奏对了才有力！", size: 16 },
  { name: "大力士挑战", emoji: "💪", color: "#D6EBFF", desc: "小电脑变成大力士，抢星星才能赢！", size: 16 },
  { name: "冠军之路", emoji: "🏆", color: "#EBDFFB", desc: "红灯+节奏+星星全都来，终极拔河！", size: 16 }
];

/**
 * 小电脑拉力按「一年级每秒 4~5 次点击」校准：
 * 红灯章只有约 2/3 时间能拉、节奏章要左右手交替（有效点速更低）、
 * 混合章机关叠加，这三章的拉力基线与坡度都相应放缓，保证章末仍然拉得赢。
 */
function buildLevel(ci: number, t: number): TugLevel {
  switch (ci) {
    case 0:
      return { aiRate: 5 + t * 0.22, pullPower: 2.6, star: false, redlight: false, rhythm: false, theme: 0 };
    case 1:
      return { aiRate: 6.5 + t * 0.3, pullPower: 2.5, star: true, redlight: false, rhythm: false, theme: 1 };
    case 2:
      return { aiRate: 4.8 + t * 0.1, pullPower: 2.6, star: false, redlight: true, rhythm: false, theme: 2 };
    case 3:
      return { aiRate: 6 + t * 0.2, pullPower: 3.0, star: false, redlight: false, rhythm: true, theme: 3 };
    case 4:
      return { aiRate: 7.5 + t * 0.3, pullPower: 2.8, star: true, redlight: false, rhythm: false, theme: 4 };
    default:
      return { aiRate: 6 + t * 0.25, pullPower: 2.8, star: true, redlight: true, rhythm: t % 2 === 1, theme: 5 };
  }
}

export const LEVELS: TugLevel[] = (() => {
  const out: TugLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();
