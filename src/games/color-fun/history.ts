/**
 * 涂色小屋 · 撤销 / 重做栈（1.2 新增，纯函数式，不碰 DOM）。
 *
 * 关卡里和自由涂色沙盒里共用同一套：每涂一块记一条「这块原来是什么色、现在是什么色」，
 * 撤销就把它倒回去。关卡内不限次数、也不扣星——涂色本来就该允许反悔。
 *
 * 有意做得很笨：只认「一块变成一种颜色」这一种操作，
 * 于是撤销永远是把 `to` 换回 `from`，不会有半路对不上的状态。
 */

/** 一次落笔 */
export interface PaintOp {
  region: string;
  /** 落笔之前这块是什么颜色，没涂过就是 null */
  from: string | null;
  to: string;
}

export class PaintHistory {
  private readonly done: PaintOp[] = [];
  private readonly undone: PaintOp[] = [];

  /** 记一笔。新落笔会把「重做」那一摞作废——这是所有编辑器的规矩 */
  push(op: PaintOp): void {
    this.done.push(op);
    this.undone.length = 0;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  /** 已经落了几笔（撤销掉的不算） */
  get size(): number {
    return this.done.length;
  }

  /** 还能重做几笔 */
  get redoSize(): number {
    return this.undone.length;
  }

  /** 撤销一笔，返回被撤掉的那一笔；没得撤返回 null */
  undo(): PaintOp | null {
    const op = this.done.pop();
    if (!op) return null;
    this.undone.push(op);
    return op;
  }

  /** 重做一笔，返回被重做的那一笔；没得重做返回 null */
  redo(): PaintOp | null {
    const op = this.undone.pop();
    if (!op) return null;
    this.done.push(op);
    return op;
  }

  /** 当前这幅画每一块是什么颜色（从空白一路重放出来） */
  replay(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const op of this.done) out[op.region] = op.to;
    return out;
  }

  /** 全部清空（`destroy` 与沙盒的「清空」都走它） */
  clear(): void {
    this.done.length = 0;
    this.undone.length = 0;
  }
}
