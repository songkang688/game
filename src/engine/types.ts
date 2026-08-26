/**
 * 「一朵一星」游戏模块约定。
 *
 * 每个小游戏放在 src/games/<游戏id>/ 目录:
 * - meta.ts:导出纯数据 `meta`(游戏信息),被首页 eager 收集,随主包加载;
 * - index.ts:导出 `mount`(挂载函数)并在顶部 re-export `meta` 保持兼容,
 *   进入游戏时才动态加载对应 chunk(按需拆包,首页不背玩法代码)。
 * 平台壳会用 import.meta.glob 自动收集并显示在首页,合并目录即上首页。
 */

/** 游戏分类:action=闯关 casual=休闲 party=对战 edu=学习 create=动手 */
export type GameCategory = "action" | "casual" | "party" | "edu" | "create";

/**
 * 游戏真实提供的玩法模式(首页玩法芯片按这个筛)。
 * campaign=闯关战役 versus=对战 endless=无尽 coop=双人合作 twoPlayer=双人同屏
 */
export type GameMode = "campaign" | "versus" | "endless" | "coop" | "twoPlayer";

/** 一款游戏可以声明的全部玩法模式(校验与遍历用) */
export const GAME_MODES: GameMode[] = ["campaign", "versus", "endless", "coop", "twoPlayer"];

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
  /**
   * 这款游戏真正做出来的玩法模式,照着实现代码填,别照 blurb 抄。
   * 不填时首页只按分类展示,玩法芯片筛不到它。
   */
  modes?: readonly GameMode[];
  /**
   * 闯关战役的总关数(没有闯关就别填)。首页进度徽章拿它当分母,
   * 不填按 DEFAULT_LEVEL_TOTAL 算。存档 key 仍旧是 `yiduo-yixing.l99.<id>`。
   */
  levels?: number;
  /** 建议年龄下限(整岁),没有可靠依据就别填 */
  ageHint?: number;
}

/** meta.levels 缺省时首页按多少关算(1.1 起通用框架就是 188 关) */
export const DEFAULT_LEVEL_TOTAL = 188;

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

/** 挂载函数:游戏把自己挂到 api.root,返回 destroy 以便离开时清理定时器、事件等 */
export type GameMount = (api: GameAPI) => { destroy: () => void };

/** 游戏实现模块:src/games/<id>/index.ts 的导出形状(meta re-export + mount) */
export interface GameImplModule {
  meta: GameMeta;
  mount: GameMount;
}

/**
 * 首页与路由使用的游戏条目(异步 mount 载体):
 * meta 随主包立即可用;load() 动态加载该游戏的实现 chunk 并返回 mount,
 * 模块加载失败或缺少 mount 时 reject。
 */
export interface GameModule {
  meta: GameMeta;
  load: () => Promise<GameMount>;
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
