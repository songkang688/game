/**
 * 1.1 新增：188 关框架 与「家长跳关」「攻略侧栏」之间的契约。
 * 只放类型与运行时注册表，不 import 任何 UI / 玩法代码,三方都能安全依赖。
 */
export interface GuideEntry {
  /** 覆盖的关卡区间(1 基,含两端) */
  from: number;
  to: number;
  title: string;
  tips: string[];
}

export interface GuideBook {
  gameId: string;
  title: string;
  /** 通用攻略:任何关都适用的几条 */
  general: string[];
  entries: GuideEntry[];
}

export interface LevelExtras {
  /** 在 host 里挂「攻略」按钮并接管面板,返回清理函数 */
  mountGuide?: (host: HTMLElement, book: GuideBook, getLevel: () => number) => () => void;
  /** 请求跳关授权(家长高权限门);resolve(true) 才允许跳关 */
  requestSkip?: (gameId: string, level: number) => Promise<boolean>;
}

let extras: LevelExtras = {};

/** 由壳层在启动时注册实现;未注册时框架自动隐藏攻略与跳关入口 */
export function registerLevelExtras(next: LevelExtras): void {
  extras = { ...extras, ...next };
}

export function getLevelExtras(): LevelExtras {
  return extras;
}

/** 仅供测试:清空注册 */
export function resetLevelExtras(): void {
  extras = {};
}
