/**
 * 家长权限门(1.1 新增)。
 *
 * 两档权限:
 *  - `basic`:打开家长面板用,沿用 1.0 的一位数乘法题(3–9 × 3–9);
 *  - `high` :跳关这类「孩子不该自己做主」的操作用,给大人做较难算数,
 *            连续答对 2 道才通过,题型在两位数乘法 / 三步混合运算 / 带余除法里随机,
 *            每题限时 45 秒,超时算错。
 *
 * 防暴力:答错 2 次锁 90 秒,锁定期间输入框与确认键禁用并显示倒计时,
 * 答错沿用 `dialog--shake` 抖动反馈。
 *
 * 授权有效期 5 分钟,**只存在内存里,绝不写 localStorage**——
 * 刷新页面即失效,孩子也翻不到任何"已授权"的痕迹。
 */
import { playSound } from "../engine/audio";
import { showDialog } from "./dialogs";

export type AuthLevel = "basic" | "high";

/** 授权有效期:5 分钟 */
export const AUTH_TTL_MS = 5 * 60_000;
/** 答错几次就锁 */
export const MAX_WRONG = 2;
/** 锁定时长:90 秒 */
export const LOCK_MS = 90_000;
/** high 档每题限时:45 秒 */
export const QUESTION_TIME_MS = 45_000;
/** high 档要连续答对几道 */
export const HIGH_NEED_CORRECT = 2;

export interface AuthPolicy {
  /** 连续答对几道算通过 */
  needCorrect: number;
  /** 答错几次锁定 */
  maxWrong: number;
  /** 锁定时长(毫秒) */
  lockMs: number;
  /** 每题限时(毫秒);Infinity 表示不限时 */
  questionMs: number;
}

export const AUTH_POLICIES: Record<AuthLevel, AuthPolicy> = {
  basic: {
    needCorrect: 1,
    maxWrong: MAX_WRONG,
    lockMs: LOCK_MS,
    questionMs: Number.POSITIVE_INFINITY
  },
  high: {
    needCorrect: HIGH_NEED_CORRECT,
    maxWrong: MAX_WRONG,
    lockMs: LOCK_MS,
    questionMs: QUESTION_TIME_MS
  }
};

// ---------------------------------------------------------------------------
// 出题
// ---------------------------------------------------------------------------

export type QuestionKind = "basic-mul" | "mul2" | "mixed3" | "divmod";

export interface AuthQuestion {
  kind: QuestionKind;
  /** 题面,例如 `27 × 18 = ?` */
  text: string;
  /** 标准答案;带余除法时这里是商 */
  answer: number;
  /** 带余除法的余数 */
  remainder?: number;
  /** 输入框里的灰字提示 */
  placeholder: string;
  /** 题面下面的一行小字说明(可选) */
  hint?: string;
}

export function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** basic 档:一位数乘法(3–9 × 3–9),沿用 1.0 的题 */
export function makeBasicQuestion(rand: () => number = Math.random): AuthQuestion {
  const a = randInt(rand, 3, 9);
  const b = randInt(rand, 3, 9);
  return { kind: "basic-mul", text: `${a} × ${b} = ?`, answer: a * b, placeholder: "答案" };
}

/** high 档题型一:两位数乘法(12–39 × 11–29) */
export function makeMul2Question(rand: () => number = Math.random): AuthQuestion {
  const a = randInt(rand, 12, 39);
  const b = randInt(rand, 11, 29);
  return { kind: "mul2", text: `${a} × ${b} = ?`, answer: a * b, placeholder: "答案" };
}

/** high 档题型二:三步混合运算(先乘除后加减,结果恒为正整数) */
export function makeMixed3Question(rand: () => number = Math.random): AuthQuestion {
  const shape = randInt(rand, 0, 2);
  let text: string;
  let answer: number;
  if (shape === 0) {
    const a = randInt(rand, 20, 60);
    const b = randInt(rand, 11, 29);
    const c = randInt(rand, 3, 9);
    const d = randInt(rand, 10, 40);
    text = `${a} + ${b} × ${c} - ${d}`;
    answer = a + b * c - d;
  } else if (shape === 1) {
    const a = randInt(rand, 11, 29);
    const b = randInt(rand, 3, 9);
    const c = randInt(rand, 10, 40);
    const d = randInt(rand, 10, 60);
    text = `${a} × ${b} - ${c} + ${d}`;
    answer = a * b - c + d;
  } else {
    const b = randInt(rand, 2, 9);
    const a = b * randInt(rand, 3, 12);
    const c = randInt(rand, 11, 29);
    const d = randInt(rand, 2, 9);
    text = `${a} ÷ ${b} + ${c} × ${d}`;
    answer = a / b + c * d;
  }
  return { kind: "mixed3", text: `${text} = ?`, answer, placeholder: "答案" };
}

/** high 档题型三:带余除法(三位数 ÷ 两位数,余数恒 ≥ 1) */
export function makeDivModQuestion(rand: () => number = Math.random): AuthQuestion {
  const divisor = randInt(rand, 12, 49);
  const minQ = Math.max(2, Math.ceil(100 / divisor));
  const maxQ = Math.floor((999 - (divisor - 1)) / divisor);
  const quotient = randInt(rand, minQ, Math.max(minQ, maxQ));
  const remainder = randInt(rand, 1, divisor - 1);
  const dividend = divisor * quotient + remainder;
  return {
    kind: "divmod",
    text: `${dividend} ÷ ${divisor} = ?`,
    answer: quotient,
    remainder,
    placeholder: "例如 12...5",
    hint: "请答「商...余...」,例如商 12 余 5 就写 12...5"
  };
}

export const HIGH_QUESTION_MAKERS: Array<(rand: () => number) => AuthQuestion> = [
  makeMul2Question,
  makeMixed3Question,
  makeDivModQuestion
];

/** high 档:在三种题型里随机挑一道 */
export function makeHighQuestion(rand: () => number = Math.random): AuthQuestion {
  const i = Math.min(HIGH_QUESTION_MAKERS.length - 1, Math.floor(rand() * HIGH_QUESTION_MAKERS.length));
  return HIGH_QUESTION_MAKERS[i](rand);
}

export function makeQuestion(level: AuthLevel, rand: () => number = Math.random): AuthQuestion {
  return level === "basic" ? makeBasicQuestion(rand) : makeHighQuestion(rand);
}

// ---------------------------------------------------------------------------
// 判题
// ---------------------------------------------------------------------------

/** 全角数字转半角并去掉空白,家长用手机输入法也不至于判错 */
function normalizeInput(raw: string): string {
  return raw
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/\s/g, "");
}

/** 解析「商...余...」:支持 `12...5` `12…5` `12余5` `商12余5` `12,5` 等写法 */
export function parseDivModInput(raw: string): { quotient: number; remainder: number } | null {
  const s = normalizeInput(raw).replace(/商/g, "").replace(/…/g, "...");
  const m = /^(\d+)(?:\.{2,}|余数|余|[,，:：、])(\d+)$/.exec(s);
  if (!m) return null;
  return { quotient: Number(m[1]), remainder: Number(m[2]) };
}

export function checkAnswer(question: AuthQuestion, raw: string): boolean {
  if (question.kind === "divmod") {
    const parsed = parseDivModInput(raw);
    return (
      parsed !== null &&
      parsed.quotient === question.answer &&
      parsed.remainder === (question.remainder ?? 0)
    );
  }
  const s = normalizeInput(raw);
  if (!/^-?\d+$/.test(s)) return false;
  return Number(s) === question.answer;
}

// ---------------------------------------------------------------------------
// 授权登记(只在内存里,绝不落盘)
// ---------------------------------------------------------------------------

const grantedUntil: Record<AuthLevel, number> = { basic: 0, high: 0 };

/** 记一次通过;有效期 5 分钟 */
export function grantAuth(level: AuthLevel, nowMs: number = Date.now()): void {
  grantedUntil[level] = nowMs + AUTH_TTL_MS;
}

/** 当前是否还在授权有效期内(high 档的授权同时满足 basic) */
export function isAuthorized(level: AuthLevel, nowMs: number = Date.now()): boolean {
  if (grantedUntil[level] > nowMs) return true;
  return level === "basic" && grantedUntil.high > nowMs;
}

/** 授权还剩多少毫秒(过期或未授权返回 0) */
export function authRemainMs(level: AuthLevel, nowMs: number = Date.now()): number {
  const until = level === "basic" ? Math.max(grantedUntil.basic, grantedUntil.high) : grantedUntil[level];
  return Math.max(0, until - nowMs);
}

/** 仅供测试:清空授权登记 */
export function resetParentAuth(): void {
  grantedUntil.basic = 0;
  grantedUntil.high = 0;
}

// ---------------------------------------------------------------------------
// 答题会话(纯逻辑,UI 只是它的一层皮)
// ---------------------------------------------------------------------------

export type SubmitResult = "passed" | "correct" | "wrong" | "timeout" | "locked";

export interface AuthSession {
  readonly level: AuthLevel;
  readonly policy: AuthPolicy;
  /** 当前这道题 */
  question(): AuthQuestion;
  /** 本轮已连续答对几道 */
  correctCount(): number;
  /** 距离锁定还差几次(即已累计答错几次) */
  wrongCount(): number;
  passed(): boolean;
  isLocked(): boolean;
  /** 锁定剩余毫秒 */
  lockRemainMs(): number;
  /** 本题剩余毫秒;不限时的档返回 Infinity */
  questionRemainMs(): number;
  /** 本题是否已超时(锁定期间不计时,恒为 false) */
  isTimedOut(): boolean;
  /** 已超时就按答错处理并换题,返回是否真的判了超时 */
  expireIfTimedOut(): boolean;
  /** 锁定结束后换新题重新开始计时;返回是否真的换了 */
  resumeAfterUnlock(): boolean;
  submit(raw: string): SubmitResult;
}

export interface AuthSessionOptions {
  /** 假时钟入口(测试用) */
  now?: () => number;
  /** 假随机入口(测试用) */
  rand?: () => number;
}

export function createAuthSession(level: AuthLevel, opts: AuthSessionOptions = {}): AuthSession {
  const now = opts.now ?? Date.now;
  const rand = opts.rand ?? Math.random;
  const policy = AUTH_POLICIES[level];

  let current = makeQuestion(level, rand);
  let deadline = now() + policy.questionMs;
  let correct = 0;
  let wrong = 0;
  let lockUntil = 0;
  let pausedForLock = false;
  let done = false;

  function nextQuestion(): void {
    current = makeQuestion(level, rand);
    deadline = now() + policy.questionMs;
  }

  function isLocked(): boolean {
    return lockUntil > now();
  }

  function applyWrong(): void {
    correct = 0;
    wrong += 1;
    if (wrong >= policy.maxWrong) {
      wrong = 0;
      lockUntil = now() + policy.lockMs;
      pausedForLock = true;
      current = makeQuestion(level, rand);
      // 锁定期间不走题目计时,解锁时再重新起表
      deadline = Number.POSITIVE_INFINITY;
      return;
    }
    nextQuestion();
  }

  function resumeAfterUnlock(): boolean {
    if (!pausedForLock || isLocked()) return false;
    pausedForLock = false;
    nextQuestion();
    return true;
  }

  function isTimedOut(): boolean {
    if (done || isLocked() || pausedForLock) return false;
    return now() >= deadline;
  }

  return {
    level,
    policy,
    question: () => current,
    correctCount: () => correct,
    wrongCount: () => wrong,
    passed: () => done,
    isLocked,
    lockRemainMs: () => Math.max(0, lockUntil - now()),
    questionRemainMs: () =>
      policy.questionMs === Number.POSITIVE_INFINITY || pausedForLock
        ? Number.POSITIVE_INFINITY
        : Math.max(0, deadline - now()),
    isTimedOut,
    expireIfTimedOut() {
      if (!isTimedOut()) return false;
      applyWrong();
      return true;
    },
    resumeAfterUnlock,
    submit(raw: string): SubmitResult {
      if (done) return "passed";
      if (isLocked()) return "locked";
      resumeAfterUnlock();
      if (isTimedOut()) {
        applyWrong();
        return "timeout";
      }
      if (checkAnswer(current, raw)) {
        correct += 1;
        if (correct >= policy.needCorrect) {
          done = true;
          grantAuth(level, now());
          return "passed";
        }
        nextQuestion();
        return "correct";
      }
      applyWrong();
      return "wrong";
    }
  };
}

// ---------------------------------------------------------------------------
// 跳关记录(家长面板里查看/清空;只读 A 写下的并存小数组,不碰原存档 key)
// ---------------------------------------------------------------------------

export const SKIP_KEY_PREFIX = "yiduo-yixing.l99skip.";

export interface SkipStorageLike {
  getItem(key: string): string | null;
  removeItem?(key: string): void;
  /** 内存实现直接给 key 列表;真 localStorage 走 length/key */
  keys?(): string[];
  readonly length?: number;
  key?(index: number): string | null;
}

export interface SkipRecord {
  gameId: string;
  /** 被跳过的关卡下标(0 基,升序) */
  levels: number[];
}

/**
 * 解析跳关小数组。两种写法都认:
 *  - 0/1(或 true/false)标记数组:下标即关号;
 *  - 关号列表(0 基整数)。
 * 数据坏了一律当作「没有跳关记录」,绝不抛异常。
 */
export function parseSkippedLevels(raw: string | null): number[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const flagLike = parsed.every(
    (v) => typeof v === "boolean" || (typeof v === "number" && (v === 0 || v === 1))
  );
  const out: number[] = [];
  if (flagLike) {
    parsed.forEach((v, i) => {
      if (v === true || v === 1) out.push(i);
    });
    return out;
  }
  for (const v of parsed) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      const level = Math.round(v);
      if (!out.includes(level)) out.push(level);
    }
  }
  return out.sort((a, b) => a - b);
}

function defaultSkipStorage(): SkipStorageLike | null {
  try {
    return (globalThis as { localStorage?: SkipStorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** 列出全部跳关记录的存储 key */
export function listSkipKeys(storage: SkipStorageLike | null): string[] {
  if (!storage) return [];
  const keys: string[] = [];
  try {
    if (typeof storage.keys === "function") {
      keys.push(...storage.keys());
    } else if (typeof storage.length === "number" && typeof storage.key === "function") {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (typeof k === "string") keys.push(k);
      }
    }
  } catch {
    return [];
  }
  return keys.filter((k) => k.startsWith(SKIP_KEY_PREFIX)).sort();
}

/** 读出各游戏的跳关记录(没有记录的游戏不出现在结果里) */
export function readSkipRecords(storage?: SkipStorageLike | null): SkipRecord[] {
  const store = storage === undefined ? defaultSkipStorage() : storage;
  if (!store) return [];
  const out: SkipRecord[] = [];
  for (const key of listSkipKeys(store)) {
    let raw: string | null = null;
    try {
      raw = store.getItem(key);
    } catch {
      raw = null;
    }
    const levels = parseSkippedLevels(raw);
    if (levels.length > 0) out.push({ gameId: key.slice(SKIP_KEY_PREFIX.length), levels });
  }
  return out;
}

/** 清空全部跳关记录,返回清掉了几个游戏的记录 */
export function clearSkipRecords(storage?: SkipStorageLike | null): number {
  const store = storage === undefined ? defaultSkipStorage() : storage;
  if (!store || typeof store.removeItem !== "function") return 0;
  const keys = listSkipKeys(store);
  let n = 0;
  for (const key of keys) {
    try {
      store.removeItem(key);
      n += 1;
    } catch {
      // 某个 key 删不掉不影响别的
    }
  }
  return n;
}

/** 把一条跳关记录写成一句人话:「3 关(第 12、35、128 关)」 */
export function formatSkipSummary(levels: number[], maxShown = 6): string {
  if (levels.length === 0) return "暂无";
  const shown = levels.slice(0, maxShown).map((l) => l + 1);
  const tail = levels.length > maxShown ? " 等" : "";
  return `${levels.length} 关(第 ${shown.join("、")} 关${tail})`;
}

// ---------------------------------------------------------------------------
// 弹窗
// ---------------------------------------------------------------------------

const LEVEL_TITLE: Record<AuthLevel, string> = {
  basic: "家长请回答",
  high: "需要家长确认"
};

const LEVEL_HINT: Record<AuthLevel, string> = {
  basic: "为了确认是家长本人,请回答一道乘法题:",
  high: "这是需要家长做主的操作,请连续答对 2 道算术题(每题 45 秒):"
};

const LEVEL_CANCEL: Record<AuthLevel, string> = {
  basic: "返回",
  high: "不同意"
};

function secondsLeft(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000));
}

/**
 * 弹出家长权限门。
 * - 还在 5 分钟授权有效期内的,直接放行,不重复打扰;
 * - 没有 DOM(单测 / 无头环境)时一律不授权,保证默认安全。
 */
export function requestParentAuth(level: AuthLevel, reason: string): Promise<boolean> {
  if (isAuthorized(level)) return Promise.resolve(true);
  if (typeof document === "undefined") return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const session = createAuthSession(level);

    const content = document.createElement("div");
    content.className = "gate-content";

    const title = document.createElement("h2");
    title.className = "dialog-title";
    title.textContent = LEVEL_TITLE[level];
    content.appendChild(title);

    if (reason) {
      const why = document.createElement("p");
      why.className = "dialog-text";
      why.textContent = reason;
      content.appendChild(why);
    }

    const hint = document.createElement("p");
    hint.className = "dialog-text";
    hint.textContent = LEVEL_HINT[level];
    content.appendChild(hint);

    const question = document.createElement("div");
    question.className = "gate-question";
    content.appendChild(question);

    const subHint = document.createElement("p");
    subHint.className = "dialog-text";
    subHint.hidden = true;
    content.appendChild(subHint);

    const status = document.createElement("p");
    status.className = "dialog-text";
    status.hidden = level !== "high";
    content.appendChild(status);

    const input = document.createElement("input");
    input.className = "gate-input";
    // high 档的带余除法要写「商...余...」,只能用文本框;basic 档沿用数字键盘
    input.type = level === "high" ? "text" : "number";
    input.inputMode = level === "high" ? "text" : "numeric";
    input.placeholder = "答案";
    input.setAttribute("aria-label", "算术题答案");
    content.appendChild(input);

    const lockMsg = document.createElement("p");
    lockMsg.className = "dialog-text";
    lockMsg.style.color = "var(--pink-deep)";
    lockMsg.style.fontWeight = "bold";
    lockMsg.hidden = true;
    content.appendChild(lockMsg);

    const handle = showDialog({
      className: "dialog--gate",
      content,
      dismissible: level === "basic",
      buttons: []
    });

    const row = document.createElement("div");
    row.className = "dialog-buttons";

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn btn--primary";
    okBtn.textContent = "确认";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--ghost";
    cancelBtn.textContent = LEVEL_CANCEL[level];

    row.append(okBtn, cancelBtn);
    content.appendChild(row);

    let timer = 0;
    let finished = false;
    function finish(ok: boolean): void {
      if (finished) return;
      finished = true;
      window.clearInterval(timer);
      handle.close();
      resolve(ok);
    }

    function renderQuestion(): void {
      const q = session.question();
      question.textContent = q.text;
      subHint.hidden = !q.hint;
      subHint.textContent = q.hint ?? "";
      input.placeholder = q.placeholder;
      input.value = "";
      if (!input.disabled) input.focus();
    }

    function renderStatus(): void {
      if (level !== "high") return;
      const remain = session.questionRemainMs();
      const clock = Number.isFinite(remain) ? ` · 本题剩余 ${secondsLeft(remain)} 秒` : "";
      status.textContent = `已答对 ${session.correctCount()}/${session.policy.needCorrect}${clock}`;
    }

    function shake(): void {
      handle.el.classList.remove("dialog--shake");
      // 触发重排以便重新播放抖动动画
      void handle.el.offsetWidth;
      handle.el.classList.add("dialog--shake");
    }

    function renderLock(): void {
      const locked = session.isLocked();
      okBtn.disabled = locked;
      input.disabled = locked;
      lockMsg.hidden = !locked;
      if (locked) {
        lockMsg.textContent = `答错太多次啦,${secondsLeft(session.lockRemainMs())} 秒后再试`;
      }
    }

    timer = window.setInterval(() => {
      // 弹窗被遮罩点掉(节点脱离文档)就当成放弃
      if (!content.isConnected) {
        finish(false);
        return;
      }
      if (session.resumeAfterUnlock()) renderQuestion();
      if (session.expireIfTimedOut()) {
        playSound("oops");
        shake();
        renderQuestion();
      }
      renderLock();
      renderStatus();
    }, 500);

    okBtn.addEventListener("click", () => {
      const result = session.submit(input.value);
      if (result === "passed") {
        playSound("coin");
        finish(true);
        return;
      }
      if (result === "locked") {
        renderLock();
        return;
      }
      if (result === "correct") {
        playSound("pop");
      } else {
        playSound("oops");
        shake();
      }
      renderQuestion();
      renderLock();
      renderStatus();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") okBtn.click();
    });

    cancelBtn.addEventListener("click", () => finish(false));

    renderQuestion();
    renderLock();
    renderStatus();
  });
}