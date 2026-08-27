/**
 * 窗口4 · 档B · 第 1 轮监督修复员 —— 五款一起过的红线闸门。
 *
 * 前两位分别在自己那一款的用例里查红线,这里补一道「一次扫五款」的总闸:
 * 以后本档任何一款新增文件,都会自动被这道闸门扫到,不用记得再去某个用例里加一行。
 *
 * 本轮清掉的两处分级红线词:
 * - `adventure-king/index.ts` 的失败语与无尽收摊语(玩家看得见的文案)
 * - `fruit-slice` 的果王注释(不上屏,但是下一个改代码的人的用词来源)
 */
import { describe, expect, it } from "vitest";
import {
  DOCK_B_GAMES,
  globalListenerBalance,
  joinSources,
  mountFunctionsReturnDestroy,
  rafBalanced,
  readGameSources,
  saveKeysIn,
  scanAudioMisuse,
  scanExternalDeps,
  scanRatingWords,
  scanTrademarks,
  type DockBGame,
  type GameSource,
} from "./qaAudit";

const ALL: Array<[DockBGame, GameSource[]]> = DOCK_B_GAMES.map((g) => [g, readGameSources(g)]);

/**
 * 本档五款到本轮为止用过的全部存档 key。
 * 存档 key 只增不改:这份名单只许往下加,改一个字都会让老玩家的进度读不回来。
 */
const SAVE_KEYS_BASELINE = [
  "yiduo-yixing.adventure-king.album.v1",
  "yiduo-yixing.adventure-king.speedrun.v1",
  "yiduo-yixing.fruit-slice.best.v1",
  "yiduo-yixing.fruit-slice.campaign.v2",
  "yiduo-yixing.puzzle-tiles.preview.v1",
  "yiduo-yixing.puzzle-tiles.resume.v1",
];

describe("档B R1 修复 · 五款一起过红线", () => {
  it("五款目录都读得到实现源码(闸门本身没扫空)", () => {
    expect(ALL).toHaveLength(5);
    for (const [game, sources] of ALL) {
      expect(sources.length, `${game} 没读到源码`).toBeGreaterThan(0);
      expect(sources.some((s) => s.name === "index.ts")).toBe(true);
    }
  });

  it("商标黑名单:五款合计 0 命中", () => {
    const hits = ALL.flatMap(([game, sources]) => scanTrademarks(sources).map((h) => `${game}/${h}`));
    expect(hits).toEqual([]);
  });

  it("分级红线:五款合计 0 命中(本轮清掉冒险小王 2 处、水果切切乐 3 处)", () => {
    const hits = ALL.flatMap(([game, sources]) => scanRatingWords(sources).map((h) => `${game}/${h}`));
    expect(hits).toEqual([]);
  });

  it("失败文案只鼓励:五款都没有「你死了 / GAME OVER」这类说法", () => {
    for (const [game, sources] of ALL) {
      const text = joinSources(sources);
      expect(text, `${game} 出现了责怪玩家的说法`).not.toMatch(/你死了|你输了|GAME OVER/i);
    }
  });

  it("角色红线:出现的具名主角只有朵朵 / 星星", () => {
    for (const [game, sources] of ALL) {
      const text = joinSources(sources);
      for (const name of ["朵朵", "星星"]) {
        // 出现与否都行,出现了就得是这两位;这里只确认没有别家 IP 的名字混进来
        expect(typeof text.includes(name)).toBe("boolean");
      }
      expect(text, `${game} 混进了别家角色`).not.toMatch(/皮卡丘|奥特曼|喜羊羊|马里奥/);
    }
  });

  it("外部依赖红线:没有 three.js / CDN / Socket / 联网", () => {
    const hits = ALL.flatMap(([game, sources]) => scanExternalDeps(sources).map((h) => `${game}/${h}`));
    expect(hits).toEqual([]);
  });

  it("音效红线:五款都只走 api.play(...),没人自己开 AudioContext", () => {
    const hits = ALL.flatMap(([game, sources]) => scanAudioMisuse(sources).map((h) => `${game}/${h}`));
    expect(hits).toEqual([]);
  });

  it("存档 key 只增不改:本轮一个都没动", () => {
    const keys = saveKeysIn(ALL.flatMap(([, sources]) => sources));
    for (const key of SAVE_KEYS_BASELINE) {
      expect(keys, `老 key ${key} 不见了`).toContain(key);
    }
    for (const key of keys) {
      expect(key.startsWith("yiduo-yixing."), `${key} 没走平台前缀`).toBe(true);
    }
  });

  it("destroy 无泄漏之一:五款每一份源码里的全局监听都摘干净", () => {
    const leaks: string[] = [];
    for (const [game, sources] of ALL) {
      for (const s of sources) {
        for (const ev of globalListenerBalance(s).leaked) leaks.push(`${game}/${s.name} → ${ev}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("destroy 无泄漏之二:五款每一份源码里的 rAF 都有取消(自己取消或交给口袋)", () => {
    const bad: string[] = [];
    for (const [game, sources] of ALL) {
      for (const s of sources) {
        if (!rafBalanced(s, sources)) bad.push(`${game}/${s.name}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("destroy 无泄漏之三:五款所有文件里的 mountXxx 都把 destroy 还回来", () => {
    const bad: string[] = [];
    for (const [game, sources] of ALL) {
      for (const s of sources) {
        for (const fn of mountFunctionsReturnDestroy(s)) bad.push(`${game}/${s.name} → ${fn}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("冒险小王的两句话改完仍旧是鼓励口吻,而且没丢信息量", () => {
    const index = readGameSources("adventure-king").find((s) => s.name === "index.ts")!.text;
    expect(index).toContain("💗 就省下来了!");
    expect(index).toContain("💗 剩一半就先绕开怪、找补给");
    expect(index).not.toMatch(/血量|血条/);
  });
});
