/**
 * 1.2 新增:「能闯关吗?能对战吗?能无尽吗?」的统一口径。
 *
 * `GameMeta.modes` 从 1.1 起就有(首页玩法芯片按它筛),但游戏内部各写各的菜单:
 * 有的写「单人 / 双人」,有的写「闯关 / 挑战」。1.2 有一批升级步要逐款补模式,
 * 先把说法定下来,免得每个窗口发明一套。
 *
 * 全是纯函数,不碰 DOM,只从 `types.ts` 取类型 —— 谁都能安全 import。
 */
import type { GameMeta, GameMode } from "./types";

/** 三大类:双人同屏 / 双人合作都归到 versus 下面,用 versusKind 细分 */
export type ModeKind = "campaign" | "versus" | "endless";

/** 三大类的固定顺序(菜单从左到右就照这个排) */
export const MODE_KINDS: ModeKind[] = ["campaign", "versus", "endless"];

/** 对战的细分:跟电脑打 / 一台设备两个人 / 两个人一起打关 */
export type VersusKind = "ai" | "hotseat" | "coop";

export interface ModeCompat {
  campaign: boolean;
  versus: boolean;
  endless: boolean;
  /** 某一类做不了时的原因(给攻略侧栏与升级步的自查用) */
  reason?: Partial<Record<ModeKind, string>>;
  /** 对战具体是哪几种(没有对战时是空数组) */
  versusKinds?: VersusKind[];
}

/** 三大类的中文名 */
export const MODE_KIND_LABELS: Record<ModeKind, string> = {
  campaign: "闯关",
  versus: "对战",
  endless: "无尽"
};

/** 对战细分的中文名 */
export const VERSUS_KIND_LABELS: Record<VersusKind, string> = {
  ai: "跟电脑对手打",
  hotseat: "两个人一台设备轮流打",
  coop: "两个人一起打"
};

const NO_MODES_REASON = "这款还没在 meta.modes 里声明模式,升级步要补上";

/** 从 `meta.modes` 推导三大类的可用性 */
export function compatFromMeta(meta: Pick<GameMeta, "modes" | "levels">): ModeCompat {
  const modes: readonly GameMode[] = Array.isArray(meta.modes) ? meta.modes : [];
  if (modes.length === 0) {
    return {
      campaign: false,
      versus: false,
      endless: false,
      versusKinds: [],
      reason: { campaign: NO_MODES_REASON, versus: NO_MODES_REASON, endless: NO_MODES_REASON }
    };
  }
  const campaign = modes.includes("campaign");
  const versus = modes.includes("versus") || modes.includes("twoPlayer") || modes.includes("coop");
  const endless = modes.includes("endless");
  const versusKinds: VersusKind[] = [];
  if (modes.includes("versus")) versusKinds.push("ai");
  if (modes.includes("twoPlayer")) versusKinds.push("hotseat");
  if (modes.includes("coop")) versusKinds.push("coop");

  const reason: Partial<Record<ModeKind, string>> = {};
  if (!campaign) reason.campaign = "这款没有闯关战役,直接开一局就好";
  if (!versus) reason.versus = "这款是一个人玩的,没有对战";
  if (!endless) reason.endless = "这款没有无尽模式,关卡打完就收工";

  return {
    campaign,
    versus,
    endless,
    versusKinds,
    reason: Object.keys(reason).length > 0 ? reason : undefined
  };
}

/** 请求了不支持的模式返回 false,绝不抛异常 */
export function assertModeMenu(compat: ModeCompat, requested: ModeKind): boolean {
  if (!compat) return false;
  if (requested !== "campaign" && requested !== "versus" && requested !== "endless") return false;
  return compat[requested] === true;
}

/**
 * 开局该进哪个模式:`want` 合法就用它,
 * 否则按 闯关 > 对战 > 无尽 取第一个能用的;一个都不能用时兜底给 `"campaign"`。
 */
export function pickInitialMode(compat: ModeCompat, want?: ModeKind): ModeKind {
  if (want && assertModeMenu(compat, want)) return want;
  for (const kind of MODE_KINDS) {
    if (compat?.[kind]) return kind;
  }
  return "campaign";
}

/** 这款游戏能玩的模式清单(菜单直接照着排) */
export function availableModes(compat: ModeCompat): ModeKind[] {
  return MODE_KINDS.filter((k) => compat?.[k] === true);
}

/**
 * 给攻略侧栏 / 暂停菜单用的一句中文。
 * 语气按小学六年级写:不低幼,也不生硬。
 */
export function describeModes(compat: ModeCompat): string {
  const have = availableModes(compat);
  if (have.length === 0) return "这款还没登记玩法模式,进去先看看关卡地图吧。";

  const parts: string[] = [];
  if (compat.campaign) parts.push("可以闯关");
  if (compat.versus) {
    const kinds = compat.versusKinds ?? [];
    if (kinds.includes("hotseat") && kinds.includes("ai")) parts.push("可以跟电脑对手打,也可以两个人一台设备轮流打");
    else if (kinds.includes("hotseat")) parts.push("可以两个人一台设备轮流打");
    else if (kinds.includes("coop")) parts.push("可以两个人一起打");
    else parts.push("可以跟电脑对手打");
  }
  if (compat.endless) parts.push("还有无尽模式一直玩下去");

  const missing = MODE_KINDS.filter((k) => !compat[k]);
  const tail =
    missing.length > 0 && missing.length < MODE_KINDS.length
      ? `;这款没有${missing.map((k) => MODE_KIND_LABELS[k]).join("和")}模式。`
      : "。";
  return `${parts.join(",")}${tail}`;
}

/** 模式切换按钮上的文案 */
export function modeButtonLabel(kind: ModeKind): string {
  const emoji: Record<ModeKind, string> = { campaign: "🚩", versus: "🤝", endless: "♾️" };
  return `${emoji[kind]} ${MODE_KIND_LABELS[kind]}`;
}

/**
 * 游戏自己那条模式入口 ↔ 三大类的对应关系。
 *
 * `key` 是游戏内部的模式名(各写各的:`"duo"` `"train"` …),
 * `kind` / `versusKind` 是这个入口在统一口径里算哪一类。
 * `kind` 省略表示这个入口不归 `meta.modes` 管(练习场那种),永远显示。
 */
export interface ModeEntry<K extends string = string> {
  key: K;
  kind?: ModeKind;
  versusKind?: VersusKind;
}

/**
 * 按 `meta.modes` 过滤模式入口条,顺序保持传进来的顺序。
 *
 * 首页芯片读 `meta.modes`,游戏内的入口条以前是各自硬写一个数组 —— 两边一改一不改
 * 就会出现「芯片说有无尽、进去找不着」。过一遍这里,菜单就没法跟 meta 各说各话。
 */
export function filterModeEntries<K extends string>(
  compat: ModeCompat,
  entries: readonly ModeEntry<K>[]
): ModeEntry<K>[] {
  const kinds = new Set(availableModes(compat));
  const versusKinds = new Set(compat?.versusKinds ?? []);
  return entries.filter((entry) => {
    if (!entry.kind) return true;
    if (!kinds.has(entry.kind)) return false;
    if (entry.kind === "versus" && entry.versusKind) return versusKinds.has(entry.versusKind);
    return true;
  });
}

/** `filterModeEntries` 的只要 key 版本:入口循环直接照这个排 */
export function modeEntryKeys<K extends string>(
  compat: ModeCompat,
  entries: readonly ModeEntry<K>[]
): K[] {
  return filterModeEntries(compat, entries).map((entry) => entry.key);
}
