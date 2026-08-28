/**
 * 1.3 新增:管理员权限打开期间,选关地图上「所有游戏所有关卡视为解锁」。
 *
 * 为什么做成共享的「地图增强」而不是去改 76 个游戏:
 * 所有闯关游戏(含答题壳 quiz99)共用 `src/games/level99.ts` 那一份选关地图,
 * 那个文件归游戏窗口管,壳层这边不碰。地图每次渲染完,由 `gameShell.ts`
 * 挂的 MutationObserver 调 `applyRootUnlock`,统一把锁着的格子改成可点:
 * 点击复用地图上现成的「🎫 直达」通道(管理员权限开着时它必定存在),
 * 星级与跳关存档一个字都不写。权限关闭 / 过期后地图重画,自然回到真实进度。
 *
 * 结构上分两层,便于在没有浏览器的 node 单测里把行为测干净:
 *  - 纯逻辑层:解析关号、生成解锁格的内容与无障碍文案(不碰真 DOM,鸭子类型);
 *  - DOM 层:`watchRootUnlock` 盯着游戏舞台,地图一出现就增强一遍。
 */
import { isRootOpen, isRootPermanent } from "./root12Contract";

/** 管理员解锁的格子挂这个类:白底虚线框,和真实进度(彩色实底)一眼区分 */
export const ROOT_UNLOCK_CLASS = "l99-node-rootopen";

/** 永久开启时地图小字不再报「还剩 XX 分钟」,直接说永久 */
export const ROOT_PERMANENT_NOTE = "管理员权限已永久开启";

/** 从关卡格的无障碍标签里解析出 1 基关号;读不出返回 null,绝不抛异常 */
export function parseLevelFromLabel(label: string | null | undefined): number | null {
  if (typeof label !== "string") return null;
  const m = label.match(/第\s*(\d+)\s*关/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** 解锁格的无障碍标签(不写吓人词,不写 root) */
export function rootUnlockAria(levelNo: number): string {
  return `第 ${levelNo} 关,管理员已解锁,点一下直接开玩`;
}

/** 解锁格的内容:关号 + 一把小锁开了的图形,复用地图自己的字号类 */
export function rootUnlockNodeHTML(levelNo: number): string {
  return `<span class="l99-node-num">${levelNo}</span><span class="l99-node-stars">🔓</span>`;
}

/** 章节页签解锁:把结尾的 🔒 摘掉,其余文字原样保留 */
export function stripLockMark(text: string | null | undefined): string {
  return (text ?? "").replace(/\s*🔒\s*$/u, "");
}

// ---------------------------------------------------------------------------
// DOM 层(鸭子类型:单测里用假节点,浏览器里就是真 DOM)
// ---------------------------------------------------------------------------

/** 锁着的关卡格(button.l99-node-lock)要用到的最小接口 */
export interface LockedNodeLike {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  classList: { add(cls: string): void; remove(cls: string): void };
  addEventListener(type: string, fn: () => void): void;
  disabled: boolean;
  innerHTML: string;
}

/** 锁着的章节页签(.l99-tab-lock)要用到的最小接口 */
export interface LockedTabLike {
  classList: { remove(cls: string): void };
  textContent: string | null;
}

/** 一张选关地图(.l99-map)要用到的最小接口 */
export interface LevelMapLike {
  querySelector(selector: string): unknown;
  querySelectorAll(selector: string): ArrayLike<unknown>;
}

/** 游戏舞台(增强的搜索起点)要用到的最小接口 */
export interface UnlockHostLike {
  querySelectorAll(selector: string): ArrayLike<unknown>;
}

/** 把一张地图上锁着的格子全部解锁,返回解锁的格子数 */
function unlockMap(map: LevelMapLike): number {
  // 点击要借道「🎫 直达」控件才能真正开这一关;控件不在就什么都不动,
  // 免得解出一排点了没反应的死按钮(管理员权限开着时它总在)
  const input = map.querySelector(".l99-jump-input") as { value: string } | null;
  const go = map.querySelector(".l99-jump .l99-tool") as { click?: () => void } | null;
  if (!input || typeof go?.click !== "function") return 0;

  let count = 0;
  const locked = map.querySelectorAll("button.l99-node-lock");
  for (let i = 0; i < locked.length; i++) {
    const node = locked[i] as LockedNodeLike;
    const levelNo = parseLevelFromLabel(node.getAttribute("aria-label"));
    if (levelNo === null) continue;
    node.classList.remove("l99-node-lock");
    node.classList.add(ROOT_UNLOCK_CLASS);
    node.disabled = false;
    node.innerHTML = rootUnlockNodeHTML(levelNo);
    node.setAttribute("aria-label", rootUnlockAria(levelNo));
    node.addEventListener("click", () => {
      input.value = String(levelNo);
      go.click?.();
    });
    count++;
  }

  const tabs = map.querySelectorAll(".l99-tab-lock");
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i] as LockedTabLike;
    tab.classList.remove("l99-tab-lock");
    tab.textContent = stripLockMark(tab.textContent);
  }

  if (isRootPermanent()) {
    const note = map.querySelector(".l99-jump-note") as { textContent: string | null } | null;
    if (note) note.textContent = ROOT_PERMANENT_NOTE;
  }
  return count;
}

/**
 * 管理员权限开着时,把 host 里所有选关地图的锁定格子统一解锁;
 * 关着 / 过期时什么都不动。幂等:解锁过的格子不再带 l99-node-lock,重跑是空转。
 * 返回本次解锁的格子数(便于测试与排查)。
 */
export function applyRootUnlock(host: UnlockHostLike, nowMs: number = Date.now()): number {
  if (!host || typeof host.querySelectorAll !== "function") return 0;
  if (!isRootOpen(nowMs)) return 0;
  let count = 0;
  const maps = host.querySelectorAll(".l99-map");
  for (let i = 0; i < maps.length; i++) {
    const map = maps[i] as LevelMapLike;
    if (typeof map?.querySelectorAll === "function") count += unlockMap(map);
  }
  return count;
}

/**
 * 盯住游戏舞台:选关地图每次渲染(进游戏、过关回地图、切章节)后自动增强。
 * 返回停止函数,壳层卸载游戏时调用。没有 MutationObserver 的环境静默降级。
 */
export function watchRootUnlock(host: HTMLElement): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  let pending = false;
  const schedule = (): void => {
    // 攒一帧再干活:showMap 是一次性同步建完整棵树,等它建完只增强一遍;
    // 增强自身引发的变更再触发时,地图上已没有锁定格,空转一次就停
    if (pending) return;
    pending = true;
    const run = (): void => {
      pending = false;
      applyRootUnlock(host);
    };
    if (typeof queueMicrotask === "function") queueMicrotask(run);
    else void Promise.resolve().then(run);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(host, { childList: true, subtree: true });
  schedule();
  return () => observer.disconnect();
}
