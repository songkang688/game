// 钓鱼小达人 · 运行时资源登记簿。
//
// 这一款有三样东西必须在 `destroy` 时还回去:requestAnimationFrame、定时器、window 监听。
// 散在各处 remove 很容易漏一两个(尤其是后加的),所以统一登记在这里:
// 谁要了什么就记一笔,`releaseAll()` 一次性还清,还完计数必须归零。
//
// 不碰任何全局对象:取消函数由调用方注入,所以在 node 环境里也能直接测。

export interface LedgerHost {
  cancelRaf?: (id: number) => void;
  clearTimer?: (id: number) => void;
}

export interface Ledger {
  /** 登记一个 rAF 句柄,原样返回方便链式写 */
  raf: (id: number) => number;
  /** 登记一个定时器句柄 */
  timer: (id: number) => number;
  /** 登记一个「取消监听」的函数 */
  listener: (off: () => void) => void;
  /** 提前还掉某个 rAF(比如重新排帧) */
  dropRaf: (id: number) => void;
  /** 还欠着几样东西 */
  size: () => number;
  /** 明细,给单测看 */
  counts: () => { rafs: number; timers: number; listeners: number };
  /** 一次性还清(幂等:再调一次什么都不会发生) */
  releaseAll: () => void;
}

export function createLedger(host: LedgerHost = {}): Ledger {
  const rafs = new Set<number>();
  const timers = new Set<number>();
  const offs: Array<() => void> = [];

  function safely(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      // 清理途中出错也要把剩下的清完,绝不半途而废
      console.warn("[一朵一星] fishing-star 清理资源出错:", err);
    }
  }

  return {
    raf(id) {
      if (Number.isFinite(id)) rafs.add(id);
      return id;
    },
    timer(id) {
      if (Number.isFinite(id)) timers.add(id);
      return id;
    },
    listener(off) {
      if (typeof off === "function") offs.push(off);
    },
    dropRaf(id) {
      if (!rafs.has(id)) return;
      rafs.delete(id);
      if (host.cancelRaf) safely(() => host.cancelRaf?.(id));
    },
    size() {
      return rafs.size + timers.size + offs.length;
    },
    counts() {
      return { rafs: rafs.size, timers: timers.size, listeners: offs.length };
    },
    releaseAll() {
      for (const id of rafs) {
        if (host.cancelRaf) safely(() => host.cancelRaf?.(id));
      }
      rafs.clear();
      for (const id of timers) {
        if (host.clearTimer) safely(() => host.clearTimer?.(id));
      }
      timers.clear();
      while (offs.length) {
        const off = offs.pop();
        if (off) safely(off);
      }
    },
  };
}
