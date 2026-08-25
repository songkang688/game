/**
 * 「一朵一星」游戏模块约定。
 *
 * 每个小游戏放在 src/games/<游戏id>/index.ts,
 * 导出 `meta`(游戏信息)和 `mount`(挂载函数),
 * 平台壳会用 import.meta.glob 自动收集并显示在首页。
 */

/** 游戏分类:action=闯关 casual=休闲 party=对战 edu=学习 create=动手 */
export type GameCategory = "action" | "casual" | "party" | "edu" | "create";

export interface GameMeta {
  /** 全局唯一 id,建议与目录名一致,只用小写字母、数字和连字符 */
  id: string;
  /** 中文标题,给小朋友看,尽量短 */
  title: string;
  /** 卡片上的表情图标,例如 "🐱" */
  emoji: string;
  /** 分类 */
  category: GameCategory;
  /** 卡片主题色(CSS 颜色,建议粉彩色) */
  color: string;
  /** 一句话介绍,给小朋友看 */
  blurb: string;
}

/** 平台内置合成音效名 */
export type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export interface GameAPI {
  /** 游戏的挂载点,游戏把自己的 DOM / canvas 放进来 */
  root: HTMLElement;
  /** 播放内置音效(Web Audio 合成,无外部资源) */
  play: (name: SoundName) => void;
  /**
   * 增减星星余额(n 可为负数,余额不会低于 0),返回最新余额。
   * 注意:onWin 会自动把胜利星星加入余额,请勿重复调用 addStars。
   */
  addStars: (n: number) => number;
  /** 查询当前星星余额 */
  getStars: () => number;
  /** 通关时调用:弹出胜利面板,自动加 stars 颗星并记录最好成绩 */
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  /** 失败时调用:弹出鼓励面板(不扣星星) */
  onLose: (message?: string) => void;
}

export interface GameModule {
  meta: GameMeta;
  /** 挂载游戏,返回 destroy 以便离开时清理定时器、事件等 */
  mount: (api: GameAPI) => { destroy: () => void };
}

/** 分类中文标签(首页页签使用) */
export const CATEGORY_LABELS: Record<GameCategory, string> = {
  action: "闯关",
  casual: "休闲",
  party: "对战",
  edu: "学习",
  create: "动手"
};

/** 分类展示顺序 */
export const CATEGORY_ORDER: GameCategory[] = [
  "action",
  "casual",
  "party",
  "edu",
  "create"
];
