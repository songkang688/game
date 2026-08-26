/**
 * 军旗对决 · 确定性随机。
 *
 * 布阵、四档 AI、关卡生成全都吃同一个 seed：同一个 seed 每次跑出来的一模一样，
 * 单测才有办法断言「地狱档赢得更多」这种事。
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 一次性取一个 0–1 的数（不想拿着生成器到处传的时候用） */
export function rand01(seed: number, salt: number): number {
  return mulberry32((seed ^ (salt * 0x9e3779b1)) >>> 0)();
}

export function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
