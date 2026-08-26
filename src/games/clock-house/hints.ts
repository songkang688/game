/**
 * 时钟小屋 1.2：连错两次时的「悄悄提示」。
 *
 * 铁律：提示只讲**方法**——先看哪儿、先算哪一段、单位之间怎么换——
 * 一个数字都不许出现，更不许把答案说出来。`hints.test.ts` 会拿 188 关全部题目的
 * 正确答案去扫这些句子，扫到一个就算不合格。
 *
 * 展示与朗读同一句：`quiz99` 让正确选项一闪一闪的那套体验原样保留（公共文件只读），
 * 本款只是把那一行提示语从通用话术换成按题型给的方法。
 */
import { typeOfKind, type ClockKind, type ClockType } from "./kinds";

/** 按题型给的方法提示（不含任何数字，也不含任何一题的答案） */
export const METHOD_HINTS: Record<ClockType, string> = {
  readFace: "先看时针落在哪两个数字之间，再回头看分针走过了几大格。",
  setHands: "先摆时针定钟点，再摆分针定零头；不是整点时，时针不会死死压在数字上。",
  elapsed: "把这段时间拆成两截：先补到整点，再算整点之后剩下的那一点。",
  shiftTime: "先弄清是往前推还是往回退，再把整小时和零头分开算，最后倒着验一遍。",
  convert1224: "先判断这个时刻是上午还是下午，再决定要不要加上或者减去半天。",
  unitConvert: "先想清楚这两个单位之间的进率，再决定该乘还是该除。",
  schedule: "读表先对准行和列，找到题目问的那一格再动笔，别急着算。",
  timezone: "先看清对方是比这边早还是比这边晚，再顺着这个方向加或者减。",
  calendar: "先按整周数过去，剩下的零头再一天一天数，不容易乱。",
};

/** 提示语开头统一挂个标记，孩子一眼知道这是「悄悄提示」而不是评语 */
export const HINT_PREFIX = "悄悄提示：";

/** 这一题该给哪句方法提示（已带前缀，展示与朗读用的是同一个字符串） */
export function methodHint(kind: ClockKind): string {
  return `${HINT_PREFIX}${METHOD_HINTS[typeOfKind(kind)]}`;
}

/** 提示语里出现数字就说明有泄题风险，纯函数便于测试 */
export function hasDigits(text: string): boolean {
  return /[0-9]/.test(text);
}
