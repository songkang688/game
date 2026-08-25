// 时钟小屋：认整点和半点的出题纯逻辑

export type ClockQuestion = {
  hour: number; // 1..12
  half: boolean; // true = X点半
  label: string;
  /** 三个时间选项文字（含正确的），已打乱 */
  choices: string[];
  answerIndex: number;
};

export function formatClock(hour: number, half: boolean): string {
  return half ? `${hour} 点半` : `${hour} 点`;
}

/** 时针角度（度，0 度指向 12，顺时针） */
export function hourHandAngle(hour: number, half: boolean): number {
  return ((hour % 12) + (half ? 0.5 : 0)) * 30;
}

/** 分针角度（度，0 度指向 12，顺时针） */
export function minuteHandAngle(half: boolean): number {
  return half ? 180 : 0;
}

function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export function makeClockQuestion(rand: () => number = Math.random): ClockQuestion {
  const hour = randInt(rand, 1, 12);
  const half = rand() < 0.5;
  const label = formatClock(hour, half);

  const set = new Set<string>([label]);
  while (set.size < 3) {
    // 干扰项：附近的小时或同小时的另一种（整点/半点），都是孩子容易看混的
    const dh = randInt(rand, -2, 2);
    let h = hour + dh;
    if (h < 1) h += 12;
    if (h > 12) h -= 12;
    set.add(formatClock(h, rand() < 0.5));
  }

  const choices = [...set];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { hour, half, label, choices, answerIndex: choices.indexOf(label) };
}
