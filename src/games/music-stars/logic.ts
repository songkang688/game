// 音乐星星：旋律序列生成纯逻辑

/**
 * 生成一段长度为 length 的星星序列（元素为 0..starCount-1 的下标）。
 * 相邻两个音不重复，听起来更像小旋律，也更好记。
 */
export function makeSequence(length: number, starCount: number, rand: () => number = Math.random): number[] {
  if (length <= 0 || starCount <= 0) return [];
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    let next = Math.floor(rand() * starCount);
    if (starCount > 1) {
      while (i > 0 && next === seq[i - 1]) {
        next = Math.floor(rand() * starCount);
      }
    }
    seq.push(next);
  }
  return seq;
}
