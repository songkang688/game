/**
 * N-38(trio-r9):l99 关内直达行小字在「永久」态显示「管理员权限还剩 4193047370 分钟」。
 *
 * 病根:`rootRemainMs()` 对永久会话返回的是到远未来的一个巨大有限数,
 * `rootJumpNote` 又无脑把它换算成分钟。地图侧早就有正确文案
 * (`rootUnlock.ts` 的 `ROOT_PERMANENT_NOTE` / `root12Contract.ts` 的 `rootStatusLine`),
 * 关内这一处漏了永久分支。纯展示层,直达语义零触碰。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { rootJumpNote } from "./level99";
import { ROOT_PERMANENT_NOTE } from "../ui/rootUnlock";
import { openRootSession, rootRemainMs, rootStatusLine } from "../ui/root12Contract";

const L99_TS = readFileSync(new URL("./level99.ts", import.meta.url), "utf8");

/** 单测里不碰真 localStorage:鸭子类型的内存存储 */
function memStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0
  } as unknown as Storage;
}

describe("N-38 直达行小字的永久态", () => {
  it("永久态说「已永久开启」,绝不再报还剩几分钟", () => {
    const note = rootJumpNote(Number.MAX_SAFE_INTEGER, true);
    expect(note).toBe(ROOT_PERMANENT_NOTE);
    expect(note).toBe("管理员权限已永久开启");
    expect(note).not.toContain("还剩");
    expect(note).not.toContain("分钟");
  });

  it("取反:限时态还是照旧报剩余分钟(老行为一个字没变)", () => {
    expect(rootJumpNote(43 * 60_000)).toBe("管理员权限还剩 43 分钟");
    expect(rootJumpNote(43 * 60_000, false)).toBe("管理员权限还剩 43 分钟");
  });

  it("真实永久会话上跑一遍:剩余毫秒确实是天文数字,而小字不再被它带跑", () => {
    const st = memStorage();
    const now = 20_000_000;
    openRootSession(now, "forever", st);
    const remain = rootRemainMs(now, st);
    // 复现截图里的 4193047370 分钟量级 —— 直接换算就是这个数
    expect(Math.round(remain / 60_000)).toBeGreaterThan(1_000_000);
    expect(rootJumpNote(remain, true)).toBe(ROOT_PERMANENT_NOTE);
  });

  it("关内小字与地图侧的统一状态文案不许各说各话", () => {
    const st = memStorage();
    const now = 20_000_000;
    openRootSession(now, "forever", st);
    expect(rootStatusLine(now, st)).toBe(rootJumpNote(rootRemainMs(now, st), true));
  });

  it("文案不写 root、不写吓人词", () => {
    const note = rootJumpNote(0, true);
    expect(note.toLowerCase()).not.toContain("root");
    expect(note).not.toContain("高权限");
  });

  it("调用点把永久标志真的传下去了(只此一处)", () => {
    expect(L99_TS).toMatch(/rootJumpNote\(rootRemainMs\(\), isRootPermanent\(\)\)/);
    // 全文件只有这一处调用,漏改不了第二处
    expect(L99_TS.match(/rootJumpNote\(/g)).toHaveLength(2); // 定义 + 唯一调用点
  });
});
