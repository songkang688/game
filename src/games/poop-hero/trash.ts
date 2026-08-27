/**
 * 便便超人 · 垃圾分类数据层(1.2 新增,纯数据 + 纯函数,不碰 DOM)。
 *
 * 三色桶按国内通行的生活垃圾分类写:
 *  - 可回收物(蓝):洗干净、擦干以后还能再做成新东西的;
 *  - 厨余垃圾(绿):吃剩下、切下来、会自然烂掉的;
 *  - 其他垃圾(灰):弄脏了没法回收、也不会烂掉的。
 *
 * 这是给孩子看的常识,所以只收**没有争议**的条目:
 * 电池、灯管、药品属于「有害垃圾」,不在这三个桶里,一条都不放进来,免得教错。
 * 「用过的纸巾」「一次性筷子」「碎陶瓷」这几条特意留着,它们正是最容易投错的。
 */

export type BinKind = "recycle" | "kitchen" | "other";

export interface BinInfo {
  kind: BinKind;
  /** 桶身上写的全名 */
  name: string;
  /** HUD 上放得下的短名 */
  short: string;
  emoji: string;
  /** 桶的颜色(粉彩化过,和画面统一) */
  color: string;
  /** 一句话说清这个桶收什么 */
  hint: string;
}

/** 三色桶的顺序固定:可回收 → 厨余 → 其他(关卡里的分类站也按这个顺序摆) */
export const BINS: readonly BinInfo[] = [
  {
    kind: "recycle",
    name: "可回收物",
    short: "可回收",
    emoji: "♻️",
    color: "#7FB2FF",
    hint: "洗干净、擦干以后还能再做成新东西的,投蓝桶。",
  },
  {
    kind: "kitchen",
    name: "厨余垃圾",
    short: "厨余",
    emoji: "🥬",
    color: "#8FD69C",
    hint: "吃剩下的、切下来的,会自己烂掉的,投绿桶。",
  },
  {
    kind: "other",
    name: "其他垃圾",
    short: "其他",
    emoji: "🗑️",
    color: "#B7B0C4",
    hint: "用过以后回收不了、也不会烂掉的,投灰桶。",
  },
];

export interface TrashItem {
  id: string;
  name: string;
  emoji: string;
  bin: BinKind;
  /** 为什么是这个桶(投对投错都会念这一句,正向讲道理) */
  why: string;
}

/** 18 条分类数据:三个桶各 6 条,都是家里天天见得到的东西 */
export const TRASH_ITEMS: readonly TrashItem[] = [
  // —— 可回收物 ——
  { id: "bottle", name: "塑料水瓶", emoji: "🧴", bin: "recycle", why: "冲一下、压扁,还能再做成新瓶子。" },
  { id: "can", name: "易拉罐", emoji: "🥫", bin: "recycle", why: "金属能一次次回炉,重新做成新罐子。" },
  { id: "paper", name: "旧报纸", emoji: "📰", bin: "recycle", why: "干净的纸能重新打成纸浆。" },
  { id: "carton", name: "纸箱板", emoji: "📦", bin: "recycle", why: "拆平摞好的纸箱是很好的回收纸。" },
  { id: "glass", name: "玻璃瓶", emoji: "🍶", bin: "recycle", why: "玻璃洗净后能重新烧成新瓶。" },
  { id: "cloth", name: "旧衣服", emoji: "👕", bin: "recycle", why: "洗净叠好的旧衣物能再利用。" },
  // —— 厨余垃圾 ——
  { id: "apple", name: "苹果核", emoji: "🍎", bin: "kitchen", why: "果核会自己烂掉,能变成花田的肥料。" },
  { id: "banana", name: "香蕉皮", emoji: "🍌", bin: "kitchen", why: "果皮属于会烂掉的厨余。" },
  { id: "leaf", name: "菜叶", emoji: "🥬", bin: "kitchen", why: "择下来的菜叶是标准的厨余。" },
  { id: "egg", name: "蛋壳", emoji: "🥚", bin: "kitchen", why: "蛋壳能和厨余一起沤成肥。" },
  { id: "rice", name: "剩米饭", emoji: "🍚", bin: "kitchen", why: "吃剩的饭菜要沥干水再投厨余桶。" },
  { id: "tea", name: "茶叶渣", emoji: "🍵", bin: "kitchen", why: "泡过的茶叶会自然分解。" },
  // —— 其他垃圾 ——
  { id: "tissue", name: "用过的纸巾", emoji: "🧻", bin: "other", why: "纸巾用过就回收不了啦,它归其他垃圾。" },
  { id: "chopstick", name: "一次性筷子", emoji: "🥢", bin: "other", why: "一次性筷子沾了油,回收不了。" },
  { id: "ceramic", name: "碎陶瓷碗", emoji: "🍽️", bin: "other", why: "陶瓷不能和玻璃一起回收,包好再投其他桶。" },
  { id: "brush", name: "旧牙刷", emoji: "🪥", bin: "other", why: "刷头和柄是粘在一起的,拆不开就回收不了。" },
  { id: "wrap", name: "保鲜膜", emoji: "🎞️", bin: "other", why: "保鲜膜太薄又沾着食物,回收不了。" },
  { id: "dust", name: "扫起来的尘土", emoji: "🪶", bin: "other", why: "扫拢的尘土直接进其他垃圾桶。" },
];

/** id → 条目 */
const BY_ID = new Map<string, TrashItem>(TRASH_ITEMS.map((t) => [t.id, t]));

export function trashById(id: string): TrashItem | null {
  return BY_ID.get(id) ?? null;
}

/** 这件东西该进哪个桶;不认识的 id 返回 null */
export function binOf(id: string): BinKind | null {
  return BY_ID.get(id)?.bin ?? null;
}

export function binInfo(kind: BinKind): BinInfo {
  return BINS.find((b) => b.kind === kind) ?? BINS[BINS.length - 1];
}

/** 某个桶收的全部条目(出题与用例都用它) */
export function itemsForBin(kind: BinKind): TrashItem[] {
  return TRASH_ITEMS.filter((t) => t.bin === kind);
}

export interface SortResult {
  ok: boolean;
  /** 投对是夸奖,投错是温和的说明 —— 两种都不带责备,也都不扣分 */
  message: string;
}

/**
 * 判一次投放。
 * **投错不扣任何分**:只回一句「换个桶试试」的说明,东西还在手上,可以再投。
 */
export function checkSort(itemId: string, bin: BinKind): SortResult {
  const item = BY_ID.get(itemId);
  if (!item) return { ok: false, message: "这件东西先放一放,我们去找别的吧。" };
  const right = binInfo(item.bin);
  if (item.bin === bin) {
    return { ok: true, message: `${item.name}投${right.short}桶,对啦!${item.why}` };
  }
  return { ok: false, message: `${item.name}放「${right.name}」更合适哦:${item.why}再试一次就好。` };
}

/** 关卡生成器按顺序取样用:保证同一个种子每次取到同一件 */
export function itemAt(index: number): TrashItem {
  const n = TRASH_ITEMS.length;
  const i = ((Math.round(index) % n) + n) % n;
  return TRASH_ITEMS[i];
}

/**
 * 讲卫生的小提示:开场横幅与结算里轮着显示。
 * 全部正向,只讲怎么做得更好,不吓唬人。
 */
export const HYGIENE_TIPS: readonly string[] = [
  "打扫完记得用肥皂洗手,搓够二十秒再冲干净。",
  "垃圾分好类,可回收的东西就能再做成新的东西。",
  "果皮菜叶投厨余桶,它们会变成花田的肥料。",
  "用过的纸巾不能回收,请投其他垃圾桶。",
  "玻璃瓶和易拉罐冲一冲再投,回收站会省很多事。",
  "扫地前先洒一点水,尘土就不会飞起来。",
  "自己带水壶和手帕,少用一次性的东西。",
  "把纸箱拆平摞好,回收车一趟能多带走一些。",
];

/** 按序号取一条小提示(确定性,便于测试与复现) */
export function hygieneTip(index: number): string {
  const n = HYGIENE_TIPS.length;
  const i = ((Math.round(index) % n) + n) % n;
  return HYGIENE_TIPS[i];
}
