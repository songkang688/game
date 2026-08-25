// 时钟小屋：认整点、半点、1 刻、3 刻的出题纯逻辑

/** 0 = 整点，1 = 1 刻（15 分），2 = 半点（30 分），3 = 3 刻（45 分） */
export type Quarter = 0 | 1 | 2 | 3;

export type ClockQuestion = {
  hour: number; // 1..12
  quarter: Quarter;
  label: string;
  /** 三个时间选项文字（含正确的），已打乱 */
  choices: string[];
  answerIndex: number;
};

export function formatClock(hour: number, quarter: Quarter): string {
  if (quarter === 0) return `${hour} 点`;
  if (quarter === 1) return `${hour} 点 1 刻`;
  if (quarter === 2) return `${hour} 点半`;
  return `${hour} 点 3 刻`;
}

/** 时针角度（度，0 度指向 12，顺时针） */
export function hourHandAngle(hour: number, quarter: Quarter): number {
  return ((hour % 12) + quarter * 0.25) * 30;
}

/** 分针角度（度，0 度指向 12，顺时针）：整点 0°，1 刻 90°，半点 180°，3 刻 270° */
export function minuteHandAngle(quarter: Quarter): number {
  return quarter * 90;
}

function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/**
 * 出一道认时间题。
 * @param allowedQuarters 本关允许出现的分钟类型（干扰项也从这里挑，保证都是学过的说法）
 */
export function makeClockQuestion(
  rand: () => number = Math.random,
  allowedQuarters: Quarter[] = [0, 2]
): ClockQuestion {
  const quarters: Quarter[] = allowedQuarters.length > 0 ? allowedQuarters : [0];
  const hour = randInt(rand, 1, 12);
  const quarter = quarters[Math.floor(rand() * quarters.length)];
  const label = formatClock(hour, quarter);

  const set = new Set<string>([label]);
  let guard = 0;
  while (set.size < 3 && guard++ < 200) {
    // 干扰项：附近的小时或同小时的另一种分钟说法，都是孩子容易看混的
    const dh = randInt(rand, -2, 2);
    let h = hour + dh;
    if (h < 1) h += 12;
    if (h > 12) h -= 12;
    const q = quarters[Math.floor(rand() * quarters.length)];
    set.add(formatClock(h, q));
  }

  const choices = [...set];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { hour, quarter, label, choices, answerIndex: choices.indexOf(label) };
}
