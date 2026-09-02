/**
 * 豆芽保卫战 · 说给孩子听的措辞收口。
 *
 * 本作从来不说「血」——头顶那条是**元气条**,虫子被打完是没劲了回家。
 * 1.2 新写的文案已经全部按这个口径写,并且有守门用例盯着
 * (`sprout12.test.ts` 的「1.2 新写的文案一律不说『血』」)。
 *
 * 剩下的一句在**前 99 关**里(第 13 关「壳壳虫有硬壳,要先敲碎再掉血!」)。
 * 那批关卡数据是 1.1 冻结的,`logic.test.ts` 拿
 * `fnv1a(JSON.stringify(LEVELS.slice(0, CLASSIC_LEVEL_COUNT)))` 做回归指纹钉着,
 * 改一个字指纹就变,那条用例当场红——而那条用例存在的意义,正是
 * 「1.1 的关卡数据一个字都不许动」。
 *
 * 所以这里换个做法:**数据一个字节不动,渲染的时候再换措辞**。
 * 指纹照旧绿,孩子看到的那一行也不再有「血」。两边的约束同时满足。
 *
 * 只用在**玩家看得见**的那一行(关卡提示)。
 */

/**
 * 替换表。长的写在前面 —— 「半血」必须排在「血」之前,
 * 不然先把「血」换掉,「半」就落单了。
 */
const SWAPS: ReadonlyArray<readonly [string, string]> = [
  ["半血", "元气掉一半"],
  ["回血", "补元气"],
  ["奶血", "补元气"],
  ["掉血", "掉元气"],
  ["吸血", "吸元气"],
  ["血量", "元气"],
  ["血条", "元气条"],
];

/**
 * 1.3 视觉步的同款收口:两句 1.2 冻结的提示里写着「☀️阳光」,
 * 屏上的太阳已经改成绘制图标,提示句里的 ☀️ 字符也在渲染时摘掉。
 * 数据照旧一个字节不动。
 */
const EMOJI_STRIPS: ReadonlyArray<string> = ["☀️"];

/**
 * 把一句给孩子看的话里的「血」换成元气的说法,顺带摘掉残留的 emoji 字符。
 * 没有命中就原样返回(绝大多数句子都走这条路,零开销)。
 */
export function kidWording(text: string): string {
  if (typeof text !== "string") return text;
  let out = text;
  if (out.includes("血")) {
    for (const [from, to] of SWAPS) out = out.split(from).join(to);
  }
  for (const emoji of EMOJI_STRIPS) {
    if (out.includes(emoji)) out = out.split(emoji).join("");
  }
  return out;
}
