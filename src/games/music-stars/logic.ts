// 音乐星星：旋律序列生成纯逻辑

/**
 * 生成一段长度为 length 的星星序列（元素为 0..starCount-1 的下标）。
 * 相邻两个音不重复，听起来更像小旋律，也更好记。
 * @param maxJump 相邻两个音的最大跨度（不传则不限制）；越小旋律越平滑，越好跟
 */
export function makeSequence(
  length: number,
  starCount: number,
  rand: () => number = Math.random,
  maxJump?: number
): number[] {
  if (length <= 0 || starCount <= 0) return [];
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    if (i === 0 || starCount === 1) {
      seq.push(Math.floor(rand() * starCount));
      continue;
    }
    const prev = seq[i - 1];
    const candidates: number[] = [];
    for (let n = 0; n < starCount; n++) {
      if (n === prev) continue;
      if (maxJump !== undefined && Math.abs(n - prev) > maxJump) continue;
      candidates.push(n);
    }
    const pool = candidates.length > 0 ? candidates : [prev];
    seq.push(pool[Math.floor(rand() * pool.length)]);
  }
  return seq;
}

/**
 * 终曲《一闪一闪亮晶晶》第一句：哆哆索索拉拉索。
 * 下标对应五声音阶 [哆,来,咪,索,拉]。
 */
export const TWINKLE_FINALE: number[] = [0, 0, 3, 3, 4, 4, 3];
