// 冒险小王 · 贴纸图鉴的「博物馆陈列」视图层(纯函数,只读收藏数据)。
//
// renderAlbum 由一行文本升级成展柜网格:每格一座展台、玻璃反光斜线,
// 未收集的画成剪影问号。这里只把收藏数据映射成「每格该长什么样」,
// 不写 localStorage、不动 explore.ts 的任何规则。

import { STICKER_SETS, stickerId } from "./explore";

export interface AlbumCellSpec {
  /** 贴纸 id(章-序号),和存档里的一致 */
  id: string;
  chapter: number;
  item: number;
  /** 章节名与章 emoji(展柜角标) */
  chapterName: string;
  chapterEmoji: string;
  /** 贴纸名(未收集时不展示,只给收集后的展牌) */
  name: string;
  got: boolean;
}

/** 把收藏数据铺成整面展柜(按章、按序,和发放顺序一致);只读入参 */
export function albumCells(album: readonly string[]): AlbumCellSpec[] {
  const got = new Set(album);
  const out: AlbumCellSpec[] = [];
  STICKER_SETS.forEach((set, ci) => {
    set.items.forEach((name, ii) => {
      const id = stickerId(ci, ii);
      out.push({
        id,
        chapter: ci,
        item: ii,
        chapterName: set.chapter,
        chapterEmoji: set.emoji,
        name,
        got: got.has(id),
      });
    });
  });
  return out;
}

export interface CaseGlyph {
  /** 展柜正中的那个字:收集到 = 章 emoji,没收集 = 剪影问号 */
  text: string;
  /** 展牌文字:收集到 = 贴纸名,没收集 = 悬念提示 */
  label: string;
  /** 额外的展柜类名(未收集 = advk-case-lock) */
  cls: string;
  /** 无障碍朗读 */
  aria: string;
}

/** 一格展柜该画成什么样(纯展示映射) */
export function caseGlyph(cell: AlbumCellSpec): CaseGlyph {
  if (!cell.got) {
    return {
      text: "❓",
      label: "还没发现",
      cls: "advk-case-lock",
      aria: `${cell.chapterName}的第 ${cell.item + 1} 张贴纸还没收集`,
    };
  }
  return {
    text: cell.chapterEmoji,
    label: cell.name,
    cls: "",
    aria: `已收集:${cell.chapterName}·${cell.name}`,
  };
}

/** 展柜汇总行:x/y 张 · 集齐 n 章(数字由调用方给,别在视图层重算规则) */
export function albumSummary(gotCount: number, total: number, chaptersDone: number): string {
  return `🏛️ 贴纸博物馆 ${gotCount}/${total} · 集齐 ${chaptersDone} 章`;
}
