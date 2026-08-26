/**
 * 红蓝拔河 · 188 关关卡表。
 *
 * 1.0 的前 99 关（六个主题赛场、四种拔河机关）一字未改：
 *  ①草地拔河=纯拼力气  ②加油星=抢星星猛拉一把  ③红灯绿灯=红灯拉绳会打滑
 *  ④节奏鼓点=左右手交替才有力  ⑤大力士挑战=星星+更强电脑  ⑥冠军之路=全机关混合
 *
 * 1.1 在末尾追加 89 关、4 个全新章节，各带一种前 99 关没有的对抗机制：
 *  ⑦沙丘角力=体力条  ⑧补给争夺=道具抢夺（防滑粉 / 水袋）
 *  ⑨齐心号子=号子连击（踩着号子攒齐心值，攒满猛拉一把）  ⑩巅峰绳王=读招电脑
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
  /** 1.1 新增 · 体力上限（每拉一下耗 1 点）；0 / 省略表示这一关不启用体力条 */
  stamina?: number;
  /** 1.1 新增 · 体力每秒回复量 */
  staminaRegen?: number;
  /** 1.1 新增 · 场上会掉补给（🧤 防滑粉自己变强、💧 水袋被对手拿到就打滑） */
  supply?: boolean;
  /** 1.1 新增 · 号子的节拍间隔（毫秒）；0 / 省略表示这一关没有号子 */
  chantMs?: number;
  /** 1.1 新增 · 齐心值攒满几下触发一次猛拉 */
  chantMax?: number;
  /** 1.1 新增 · 读招强度 0..1：眼看你要赢，小电脑就发力反扑 */
  aiAdapt?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "草地拔河", emoji: "🌿", color: "#E2F7DF", desc: "狂点按钮，把绳子拉过来！", size: 17 },
  { name: "加油星", emoji: "⭐", color: "#FFF3C4", desc: "加油星一闪就去抢，猛拉一大把！", size: 17 },
  { name: "红灯绿灯", emoji: "🚦", color: "#FFE0E0", desc: "红灯拉绳会打滑，看准绿灯再用力！", size: 17 },
  { name: "节奏鼓点", emoji: "🥁", color: "#FFE9D6", desc: "左手右手轮着拉，节奏对了才有力！", size: 16 },
  { name: "大力士挑战", emoji: "💪", color: "#D6EBFF", desc: "小电脑变成大力士，抢星星才能赢！", size: 16 },
  { name: "冠军之路", emoji: "🏆", color: "#EBDFFB", desc: "红灯+节奏+星星全都来，终极拔河！", size: 16 },
  // ---- 1.1 追加的 89 关：四个全新章节，各带一种前 99 关没有的对抗机制 ----
  { name: "沙丘角力", emoji: "🏜️", color: "#FFF0DC", desc: "连点会累，体力见底力气减半，学会松手换气！", size: 23 },
  { name: "补给争夺", emoji: "🧤", color: "#E8F3FF", desc: "防滑粉和水袋掉在场上，谁先抢到谁占便宜！", size: 22 },
  { name: "齐心号子", emoji: "📣", color: "#FFE7EE", desc: "踩着「嘿—哟」的号子拉，齐心值攒满猛拉一大把！", size: 22 },
  { name: "巅峰绳王", emoji: "🥇", color: "#EFE6FA", desc: "眼看你要赢，小电脑就发力反扑，全机关混战！", size: 22 }
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
    // ---- 1.1 新章：小学六年级向，光靠狂点不够，还得管体力、抢补给、踩号子 ----
    case 6:
      // 沙丘角力：力气够大，但一路狂点会累到只剩半条力气
      return {
        aiRate: 11.5 + t * 0.07,
        pullPower: 3.2,
        star: false,
        redlight: false,
        rhythm: false,
        theme: 6,
        stamina: 26 - Math.floor(t / 6),
        staminaRegen: 5.2 - t * 0.03
      };
    case 7:
      // 补给争夺：加油星照旧，另外还会掉防滑粉与水袋，抢慢了就轮到自己打滑
      return {
        aiRate: 13.5 + t * 0.12,
        pullPower: 2.8,
        star: true,
        redlight: false,
        rhythm: false,
        theme: 7,
        supply: true
      };
    case 8:
      // 齐心号子：踩着号子拉才使得上劲，攒满齐心值猛拉一大把
      return {
        aiRate: 12.6 + t * 0.14,
        pullPower: 3.4,
        star: false,
        redlight: false,
        rhythm: false,
        theme: 8,
        chantMs: 300 - t * 4,
        chantMax: 8 + Math.floor(t / 7)
      };
    case 9:
      // 巅峰绳王：读招电脑 + 体力 + 补给 + 隔关加号子，全机关混战
      return {
        aiRate: 11 + t * 0.12,
        pullPower: 3.1,
        star: true,
        redlight: t % 2 === 0,
        rhythm: t % 4 === 3,
        theme: 9,
        aiAdapt: 0.18 + t * 0.008,
        stamina: 26 - Math.floor(t / 8),
        staminaRegen: 5.8 - t * 0.03,
        supply: true,
        chantMs: t % 2 === 1 ? 280 - t * 2 : 0,
        chantMax: 9
      };
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
