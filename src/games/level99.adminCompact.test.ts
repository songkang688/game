/**
 * N-37 / N-38 / N-39(trio-r9)
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { ROOT_PERMANENT_NOTE } from "../ui/rootUnlock";
import {
  clearRootSession,
  openRootSession,
  resetRoot12Extras,
  ROOT_TTL_MS,
  writeRootSession
} from "../ui/root12Contract";
import { rootJumpNote } from "./level99";

const SRC = readFileSync(new URL("./level99.ts", import.meta.url), "utf8");
const NOW = 1_700_000_000_000;

describe("N-38 永久态直达小字", () => {
  beforeEach(() => {
    resetRoot12Extras();
    clearRootSession(null);
  });

  it("永久开启时报已永久开启,绝不再出现还剩 N 分钟", () => {
    openRootSession(NOW, "forever", null);
    const note = rootJumpNote(4193047370 * 60_000, NOW);
    expect(note).toBe(ROOT_PERMANENT_NOTE);
    expect(note).not.toContain("还剩");
    expect(note).not.toContain("分钟");
  });

  it("限时态仍报剩余分钟", () => {
    writeRootSession(NOW + ROOT_TTL_MS, null, "timed");
    expect(rootJumpNote(43 * 60_000, NOW)).toBe("管理员权限还剩 43 分钟");
  });
});

describe("N-37 root 开着时关内抬头收成一行", () => {
  it("关内才生成 .l99-admin-row,root 关着走原来的 attachSkip 直挂", () => {
    expect(SRC).toContain('admin.className = "l99-admin-row"');
    expect(SRC).toContain("if (rootJumpVisible())");
    expect(SRC).toContain("attachSkip(barTools, level, afterSkip, false)");
  });

  it("矮屏媒体查询把跳过/直达收成一行", () => {
    expect(SRC).toContain("@media (max-height:500px)");
    expect(SRC).toContain(".l99-stagebar .l99-admin-row{flex-wrap:nowrap;width:100%;}");
  });
});

describe("N-39 蓝本地图首次进图聚焦当前关", () => {
  it("初次挂载与回地图走 showMap(true),切章仍走默认 false", () => {
    expect(SRC).toContain("showMap(true);");
    expect(SRC).toMatch(/viewChapter = ci;\s*showMap\(\);/);
    expect(SRC).toContain("onClick: () => showMap(true)");
  });
});
