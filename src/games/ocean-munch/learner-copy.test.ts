/**
 * 窗口3 · 1.3 第 1 轮学习优化员 · 文案快照。
 * 把「毒藻鱼绿色气泡光环」与「金冠 / 银星发带认敌我」讲进了攻略,
 * 钉住这句不被回退,同时钉住攻略结构没有被文案改动碰坏。
 */
import { describe, expect, it } from "vitest";
import guide from "./guide";

describe("海底大胃王 · 学习优化员文案快照", () => {
  it("攻略把 1.3 的毒藻光环与头饰双通道讲给玩家(逐字快照)", () => {
    expect(guide.general).toContain(
      "看装饰认敌我:绕着一圈绿色气泡光环的是毒藻鱼,再小也别咬;对战里你戴金色小皇冠、对手戴银星发带,追起来一眼就认得出谁是谁。"
    );
  });

  it("文案改动没有碰坏攻略结构:十二段首尾相接铺满 188 关", () => {
    expect(guide.entries).toHaveLength(12);
    expect(guide.entries[0].from).toBe(1);
    expect(guide.entries[guide.entries.length - 1].to).toBe(188);
  });

  // 第 2 轮:把 visual-r1 画制化的心心(玩家/大家伙两排)与护盾徽章讲进攻略
  it("攻略把画制心心与护盾徽章的读法讲给玩家(第 2 轮逐字快照)", () => {
    expect(guide.general.join("")).toContain(
      "顶栏那排小心心就是你的元气,灰一颗少一口;闯关碰到大家伙时它头顶也顶着一排心心,你每咬中一次就灰一颗,看两排心心就知道这一仗还差多远。吃到护盾身上会亮一圈小盾徽、右上角带读秒,读完之前尽管大胆游。"
    );
    expect(guide.general.length).toBeLessThanOrEqual(6);
  });
});
