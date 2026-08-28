/**
 * 1.2 新增:管理员权限的密码门(只管「怎么问密码」)。
 *
 * 会话读写一律走 `root12Contract.ts`,本文件不自己存任何东西 ——
 * 尤其是**密码绝不写进 localStorage / sessionStorage / cookie / URL**,落盘的只有过期时间。
 * 1.1 的算术家长门(`parentAuth.ts`)一个字都不改,两道门各管各的。
 *
 * 结构上分成两层,方便在没有浏览器的环境里把行为测干净:
 *  - 纯逻辑层:锁定计数、密码判定、弹窗内容清单(`rootDialogSpec`),不碰 DOM;
 *  - DOM 层:`requestRootOpen` 按清单把弹窗画出来,复用 `dialogs.ts` 的 `showDialog`。
 */
import { showDialog, type DialogHandle } from "./dialogs";
import {
  ROOT_ADMIN_PHONE,
  ROOT_DEFAULT_DURATION,
  ROOT_DEFAULT_PASSWORD,
  ROOT_DURATION_CHOICES,
  ROOT_LOCK_MS,
  ROOT_MAX_WRONG,
  clearRootSession,
  isRootOpen,
  openRootSession,
  registerRoot12Extras,
  rootStatusLine,
  type RootDurationKey,
  type RootStorageLike
} from "./root12Contract";

/** 弹窗上必须原样出现的那句话 */
export const ROOT_CONTACT_LINE = `要打开请联系管理员 ${ROOT_ADMIN_PHONE}`;

/** 时钟可注入:测试用假时钟推进 1 小时 / 120 秒,不真等 */
let now: () => number = () => Date.now();

/** 仅测试用:换掉时钟 */
export function setRootClock(fn: () => number): void {
  now = fn;
}

/** 仅测试用:换回真时钟 */
export function useRealRootClock(): void {
  now = () => Date.now();
}

// ---------------------------------------------------------------------------
// 纯逻辑层:锁定与密码判定
// ---------------------------------------------------------------------------

let wrongCount = 0;
let lockUntil = 0;

/** 还在锁定期就返回剩余毫秒,否则 0 */
export function rootLockRemainMs(nowMs: number = now()): number {
  return Math.max(0, lockUntil - nowMs);
}

/** 锁定倒计时文案:锁着时报还剩几秒 */
export function rootLockText(remainMs: number): string {
  const sec = Math.max(1, Math.ceil(remainMs / 1000));
  return `密码连着输错了,先歇 ${sec} 秒再试一次。`;
}

/**
 * 家长面板旁边显示的一行状态(六年级语气,不写吓人词)。
 * 永久开启时不再说「还剩 X 分钟」,而是「已永久开启」;文案统一走契约的 rootStatusLine。
 */
export function rootStatusText(nowMs: number = now(), storage?: RootStorageLike | null): string {
  return rootStatusLine(nowMs, storage);
}

/** 一次密码尝试的结果(弹窗照着它更新界面) */
export interface RootAttempt {
  /** 密码对不对 */
  ok: boolean;
  /** 这一下之后门是不是开着 */
  opened: boolean;
  /** 是不是刚被锁住 / 仍然锁着 */
  locked: boolean;
  /** 锁定剩余毫秒,没锁就是 0 */
  lockRemainMs: number;
  /** 给孩子和大人看的一句话 */
  tip: string;
}

/**
 * 判定一次密码输入并更新锁定状态。
 * 密码只在参数里活过这一瞬,不写进任何存储。
 * duration 是时长选项的 key(30 分钟 / 1 小时 / 4 小时 / 永久),缺省 1 小时。
 */
export function submitRootPassword(
  password: string,
  nowMs: number = now(),
  storage?: RootStorageLike | null,
  duration: RootDurationKey | string = ROOT_DEFAULT_DURATION
): RootAttempt {
  const lockRemain = rootLockRemainMs(nowMs);
  if (lockRemain > 0) {
    return {
      ok: false,
      opened: isRootOpen(nowMs, storage),
      locked: true,
      lockRemainMs: lockRemain,
      tip: rootLockText(lockRemain)
    };
  }
  if (password === ROOT_DEFAULT_PASSWORD) {
    wrongCount = 0;
    lockUntil = 0;
    openRootSession(nowMs, duration, storage);
    return {
      ok: true,
      opened: true,
      locked: false,
      lockRemainMs: 0,
      tip: rootStatusText(nowMs, storage)
    };
  }
  wrongCount++;
  if (wrongCount >= ROOT_MAX_WRONG) {
    wrongCount = 0;
    lockUntil = nowMs + ROOT_LOCK_MS;
    return {
      ok: false,
      opened: isRootOpen(nowMs, storage),
      locked: true,
      lockRemainMs: ROOT_LOCK_MS,
      tip: rootLockText(ROOT_LOCK_MS)
    };
  }
  return {
    ok: false,
    opened: isRootOpen(nowMs, storage),
    locked: false,
    lockRemainMs: 0,
    tip: `密码不对,还可以再试 ${ROOT_MAX_WRONG - wrongCount} 次。`
  };
}

/** 弹窗里的一颗按钮 */
export interface RootDialogButton {
  key: "open" | "cancel" | "close";
  label: string;
}

/** 弹窗里的一个时长选项(默认 1 小时被选中) */
export interface RootDialogDuration {
  key: RootDurationKey;
  label: string;
  selected: boolean;
}

/** 弹窗内容清单:DOM 层照着画,测试层照着断言 */
export interface RootDialogSpec {
  title: string;
  desc: string;
  /** 那句必须原样出现的联系方式 */
  phoneLine: string;
  /** 密码框类型,永远是 password */
  inputType: "password";
  inputLabel: string;
  /** 「开多久」的选项,默认选中 1 小时,最后一项是永久 */
  durations: RootDialogDuration[];
  durationLabel: string;
  buttons: RootDialogButton[];
  /** 锁定期间输入框与「打开」都要禁用 */
  inputDisabled: boolean;
  tip: string;
}

export function rootDialogSpec(
  reason = "要用管理员权限",
  nowMs: number = now(),
  storage?: RootStorageLike | null
): RootDialogSpec {
  const lockRemain = rootLockRemainMs(nowMs);
  const opened = isRootOpen(nowMs, storage);
  const buttons: RootDialogButton[] = [
    { key: "open", label: "打开" },
    { key: "cancel", label: "不打开" }
  ];
  if (opened) buttons.push({ key: "close", label: "关闭管理员权限" });
  return {
    title: "管理员权限",
    desc: `${reason}。输入管理员密码、选好开多久就能打开;打开期间所有关卡都能玩。`,
    phoneLine: ROOT_CONTACT_LINE,
    inputType: "password",
    inputLabel: "管理员密码",
    durations: ROOT_DURATION_CHOICES.map((c) => ({
      key: c.key,
      label: c.label,
      selected: c.key === ROOT_DEFAULT_DURATION
    })),
    durationLabel: "开多久",
    buttons,
    inputDisabled: lockRemain > 0,
    tip: lockRemain > 0 ? rootLockText(lockRemain) : opened ? rootStatusText(nowMs, storage) : ""
  };
}

/** 立刻关闭管理员权限 */
export function closeRoot(): void {
  clearRootSession();
}

/** 仅测试用:清掉锁定计数与会话 */
export function resetRootGate(): void {
  wrongCount = 0;
  lockUntil = 0;
  clearRootSession();
}

// ---------------------------------------------------------------------------
// DOM 层
// ---------------------------------------------------------------------------

const STYLE_ID = "root-gate-style";
const ROOT_GATE_CSS = `
.rootgate{display:flex;flex-direction:column;gap:10px;max-width:320px;text-align:center}
.rootgate-title{margin:0;font-size:20px;font-weight:900;color:#5c4a7d}
.rootgate-desc{margin:0;font-size:16px;font-weight:700;color:#5b4a80;line-height:1.5;
  overflow-wrap:anywhere;word-break:break-word}
.rootgate-phone{margin:0;font-size:16px;font-weight:800;color:#98305f;line-height:1.5;
  overflow-wrap:anywhere;word-break:break-word}
.rootgate-input{min-height:46px;border:3px solid #e6dcf5;border-radius:14px;padding:0 14px;
  font-family:inherit;font-size:17px;font-weight:700;color:#4a3a6b;background:#fff}
.rootgate-input:disabled{opacity:.55}
.rootgate-durlabel{margin:0;font-size:15px;font-weight:800;color:#5b4a80}
.rootgate-durs{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.rootgate-dur{min-height:44px;border:2px solid #e6dcf5;border-radius:999px;padding:0 16px;cursor:pointer;
  font-family:inherit;font-size:15px;font-weight:800;color:#5b4a80;background:#fff}
.rootgate-dur[aria-pressed="true"]{background:linear-gradient(180deg,#c84483,#ad3a72);
  border-color:transparent;color:#fff;box-shadow:0 3px 0 #8f2c5c}
.rootgate-dur:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px}
.rootgate-tip{margin:0;min-height:20px;font-size:15px;font-weight:800;color:#7a4a96;line-height:1.4}
.rootgate-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.rootgate-btn{min-height:46px;border:0;border-radius:16px;padding:0 20px;cursor:pointer;
  font-family:inherit;font-size:16px;font-weight:900;color:#fff;
  background:linear-gradient(180deg,#c84483,#ad3a72);box-shadow:0 4px 0 #8f2c5c}
.rootgate-btn:disabled{opacity:.5;cursor:default}
.rootgate-btn.rootgate-ghost{background:linear-gradient(180deg,#5470c0,#4560ab);box-shadow:0 4px 0 #34498a}
.rootgate-btn.rootgate-off{background:linear-gradient(180deg,#7c7396,#615980);box-shadow:0 4px 0 #4b4463}
.rootgate-btn:focus-visible,.rootgate-input:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px}
/* N-109:915×412 弹窗盒内「打开/不打开」初见 413~459 折线下(盒可滚,功能没坏,观感账)。
   矮横屏放宽列宽让四个时长胶囊排成一行(省一整行 52px)、收 gap 与空 tip 行,
   CTA 进 412。字号一个不动(说明文字 16px 红线),390/1024 不落档零变化。 */
@media (max-height:500px){
  .rootgate{max-width:520px;gap:6px}
  .rootgate-tip{min-height:0}
  .rootgate-input{min-height:44px}
  .rootgate-btn{min-height:44px}
}
`;

function ensureStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = ROOT_GATE_CSS;
  document.head.appendChild(style);
}

/**
 * 弹密码框请求打开管理员权限。
 * resolve(true) 表示这会儿门是开着的(本次输对,或者本来就开着)。
 */
export function requestRootOpen(reason = "要用管理员权限"): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(isRootOpen(now()));
  ensureStyle();

  return new Promise<boolean>((resolve) => {
    const spec = rootDialogSpec(reason, now());

    const content = document.createElement("div");
    content.className = "rootgate";

    const title = document.createElement("h3");
    title.className = "rootgate-title";
    title.textContent = spec.title;

    const desc = document.createElement("p");
    desc.className = "rootgate-desc";
    desc.textContent = spec.desc;

    const phone = document.createElement("p");
    phone.className = "rootgate-phone";
    phone.textContent = spec.phoneLine;

    const input = document.createElement("input");
    input.type = spec.inputType;
    input.className = "rootgate-input";
    input.autocomplete = "off";
    input.setAttribute("aria-label", spec.inputLabel);
    input.placeholder = spec.inputLabel;

    // 「开多久」:一排胶囊,默认选中 1 小时,最后一项是永久
    let durationKey: RootDurationKey = ROOT_DEFAULT_DURATION;
    const durLabel = document.createElement("p");
    durLabel.className = "rootgate-durlabel";
    durLabel.textContent = spec.durationLabel;
    const durRow = document.createElement("div");
    durRow.className = "rootgate-durs";
    durRow.setAttribute("role", "group");
    durRow.setAttribute("aria-label", spec.durationLabel);
    const durBtns = new Map<RootDurationKey, HTMLButtonElement>();
    for (const d of spec.durations) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rootgate-dur";
      btn.textContent = d.label;
      btn.setAttribute("aria-pressed", String(d.selected));
      btn.addEventListener("click", () => {
        durationKey = d.key;
        for (const [key, el] of durBtns) el.setAttribute("aria-pressed", String(key === d.key));
      });
      durRow.appendChild(btn);
      durBtns.set(d.key, btn);
    }

    const tip = document.createElement("p");
    tip.className = "rootgate-tip";
    tip.setAttribute("role", "status");
    tip.textContent = spec.tip;

    const row = document.createElement("div");
    row.className = "rootgate-row";
    const byKey = new Map<RootDialogButton["key"], HTMLButtonElement>();
    for (const b of spec.buttons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `rootgate-btn${b.key === "cancel" ? " rootgate-ghost" : ""}${
        b.key === "close" ? " rootgate-off" : ""
      }`;
      btn.textContent = b.label;
      row.appendChild(btn);
      byKey.set(b.key, btn);
    }

    content.append(title, desc, phone, input, durLabel, durRow, tip, row);

    let ticker: ReturnType<typeof setInterval> | null = null;
    let settled = false;
    let handle: DialogHandle | null = null;

    const stopTicker = (): void => {
      if (ticker !== null) {
        clearInterval(ticker);
        ticker = null;
      }
    };

    const finish = (opened: boolean): void => {
      if (settled) return;
      settled = true;
      stopTicker();
      // 输入框里的字符一并抹掉,连 DOM 里都不留密码
      input.value = "";
      handle?.close();
      resolve(opened);
    };

    const refreshLock = (): void => {
      const remain = rootLockRemainMs(now());
      const locked = remain > 0;
      input.disabled = locked;
      const okBtn = byKey.get("open");
      if (okBtn) okBtn.disabled = locked;
      if (locked) {
        tip.textContent = rootLockText(remain);
      } else if (tip.textContent?.startsWith("密码连着输错了")) {
        tip.textContent = "";
        stopTicker();
      }
    };

    const startTicker = (): void => {
      if (ticker !== null) return;
      const g = globalThis as { setInterval?: typeof setInterval };
      if (!g.setInterval) return;
      ticker = g.setInterval(() => {
        if (settled) {
          stopTicker();
          return;
        }
        refreshLock();
      }, 1000);
    };

    const submit = (): void => {
      if (settled) return;
      const attempt = submitRootPassword(input.value, now(), undefined, durationKey);
      input.value = "";
      if (attempt.ok) {
        finish(true);
        return;
      }
      tip.textContent = attempt.tip;
      content.classList.add("dialog--shake");
      const g = globalThis as { setTimeout?: typeof setTimeout };
      g.setTimeout?.(() => content.classList.remove("dialog--shake"), 400);
      if (attempt.locked) {
        refreshLock();
        startTicker();
      }
    };

    byKey.get("open")?.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
    byKey.get("cancel")?.addEventListener("click", () => finish(isRootOpen(now())));
    byKey.get("close")?.addEventListener("click", () => {
      closeRoot();
      finish(false);
    });

    handle = showDialog({
      content,
      label: "管理员权限",
      dismissible: true,
      onDismiss: () => finish(isRootOpen(now()))
    });

    refreshLock();
    if (rootLockRemainMs(now()) > 0) startTicker();
  });
}

registerRoot12Extras({ requestRootOpen, closeRoot });
