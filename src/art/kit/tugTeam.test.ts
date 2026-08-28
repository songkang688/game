/**
 * 1.3 共享美术套件 · 拔河小队用例(窗口8 C 档)。
 *
 * 钉住 4.2 工序单:队色 token、领队/队员的表情与头饰差异、
 * 三只错位的间距与缩放、三种姿态(拉绳 / 欢呼 / 坐地吐舌)。
 */
import { describe, expect, it } from "vitest";

import {
  BASE_LEAN_DEG,
  PULLER_H,
  PULLER_W,
  SQUAD_W,
  TEAM_SCALES,
  TEAM_SPACING,
  TUG_ART,
  teamColors,
  tugPullerSvg,
  tugTeamHtml,
} from "./tugTeam";

describe("art/kit · 拔河小队色板", () => {
  it("题材色 token 与规格表一字不差", () => {
    expect(TUG_ART.tugRed).toBe("#ff6b6b");
    expect(TUG_ART.tugRedDark).toBe("#e14b4b");
    expect(TUG_ART.tugBlue).toBe("#5b9bff");
    expect(TUG_ART.tugBlueDark).toBe("#3d78e0");
    expect(TUG_ART.ropeTan).toBe("#d9a066");
    expect(TUG_ART.ropeLine).toBe("#a06b3a");
    expect(TUG_ART.ribbonRed).toBe("#ff3355");
    expect(TUG_ART.riverTop).toBe("#8fd3ff");
    expect(TUG_ART.riverBottom).toBe("#5b9bff");
    expect(TUG_ART.grassLight).toBe("#b8e986");
    expect(TUG_ART.grassDark).toBe("#8fc866");
    expect(TUG_ART.skyTop).toBe("#cfeaff");
    expect(TUG_ART.skyBottom).toBe("#f4fbff");
  });

  it("teamColors 红蓝各取各的主色与深色", () => {
    expect(teamColors("red")).toEqual({ main: TUG_ART.tugRed, dark: TUG_ART.tugRedDark });
    expect(teamColors("blue")).toEqual({ main: TUG_ART.tugBlue, dark: TUG_ART.tugBlueDark });
  });
});

describe("art/kit · 单只拔河小人", () => {
  it("红队含 tugRed 不含 tugBlue,蓝队反之 —— 互不串色", () => {
    const red = tugPullerSvg({ side: "red" });
    const blue = tugPullerSvg({ side: "blue" });
    expect(red).toContain(TUG_ART.tugRed);
    expect(red).toContain(TUG_ART.tugRedDark);
    expect(red).not.toContain(TUG_ART.tugBlue);
    expect(red).not.toContain(TUG_ART.tugBlueDark);
    expect(blue).toContain(TUG_ART.tugBlue);
    expect(blue).toContain(TUG_ART.tugBlueDark);
    expect(blue).not.toContain(TUG_ART.tugRed);
    expect(blue).not.toContain(TUG_ART.tugRedDark);
  });

  it("viewBox 48×56,躯干走队色渐变,圆头肤色 + 2px 队色深描边", () => {
    const svg = tugPullerSvg({ side: "red" });
    expect(PULLER_W).toBe(48);
    expect(PULLER_H).toBe(56);
    expect(svg).toContain(`viewBox="0 0 48 56"`);
    expect(svg).toMatch(/data-part="torso"[^>]*fill="url\(#rbgTugGradR\)"/);
    expect(svg).toMatch(/data-part="head"[^>]*fill="#ffe3c8"[^>]*stroke-width="2"/);
  });

  it("手臂是两条圆端粗线(stroke-width:5),手部小圆握在绳带上", () => {
    const svg = tugPullerSvg({ side: "red" });
    expect(svg).toMatch(/data-part="arm"[^>]*stroke-width="5"[^>]*stroke-linecap="round"/);
    expect((svg.match(/data-part="hand"/g) ?? []).length).toBe(2);
  });

  it("领队与队员的表情差异:领队咬牙 + 鼓腮,队员豆点眼 + 抿嘴", () => {
    const leader = tugPullerSvg({ side: "red", role: "leader" });
    const member = tugPullerSvg({ side: "red", role: "member" });
    expect(leader).toContain(`data-part="teeth"`);
    expect(leader).toContain(`data-part="cheek"`);
    expect(member).not.toContain(`data-part="teeth"`);
    expect(member).not.toContain(`data-part="cheek"`);
    expect(member).toContain(`data-part="mouth"`);
  });

  it("红队领队戴头带、蓝队领队戴帽子,普通队员都不戴", () => {
    const redLeader = tugPullerSvg({ side: "red", role: "leader" });
    const blueLeader = tugPullerSvg({ side: "blue", role: "leader" });
    expect(redLeader).toContain(`data-part="headband"`);
    expect(redLeader).not.toContain(`data-part="hat"`);
    expect(blueLeader).toContain(`data-part="hat"`);
    expect(blueLeader).not.toContain(`data-part="headband"`);
    expect(tugPullerSvg({ side: "red" })).not.toContain(`data-part="headband"`);
    expect(tugPullerSvg({ side: "blue" })).not.toContain(`data-part="hat"`);
  });

  it("脚下有 rgba(0,0,0,.12) 椭圆阴影,且跟着 --rbg-shx 反向偏", () => {
    const svg = tugPullerSvg({ side: "red" });
    expect(svg).toMatch(/data-part="shadow"[^>]*fill="rgba\(0,0,0,\.12\)"/);
    expect(svg).toContain("var(--rbg-shx,0px)");
  });

  it("胜方欢呼张嘴笑、败方坐地吐舌头 —— 输赢都是笑着收场", () => {
    const cheer = tugPullerSvg({ side: "red", pose: "cheer" });
    const sit = tugPullerSvg({ side: "blue", pose: "sit" });
    expect(cheer).toContain(`data-part="laugh"`);
    expect(sit).toContain(`data-part="tongue"`);
    // 谁都不许哭:两种收场姿态里没有眼泪类节点
    expect(cheer + sit).not.toContain(`data-part="tear"`);
  });

  it("蓝队整体镜像,绳子方向对得上", () => {
    expect(tugPullerSvg({ side: "blue" })).toContain(`scale(-1 1) translate(-48 0)`);
    expect(tugPullerSvg({ side: "red" })).not.toContain("scale(-1 1)");
  });
});

describe("art/kit · 三只一队的错位排布", () => {
  it("缩放定格在 1 / 0.92 / 0.86,间距 26px,站位角基准 6°", () => {
    expect([...TEAM_SCALES]).toEqual([1, 0.92, 0.86]);
    expect(TEAM_SPACING).toBe(26);
    expect(BASE_LEAN_DEG).toBe(6);
    expect(SQUAD_W).toBe(26 * 2 + 48);
  });

  it("一队正好 3 只,三档缩放各出现一次", () => {
    const html = tugTeamHtml("red");
    expect((html.match(/class="rbg-slot"/g) ?? []).length).toBe(3);
    expect(html).toContain("transform:scale(1)");
    expect(html).toContain("transform:scale(0.92)");
    expect(html).toContain("transform:scale(0.86)");
    expect(html).toContain("left:0px");
    expect(html).toContain("left:26px");
    expect(html).toContain("left:52px");
  });

  it("领队在最靠绳位:红队最右、蓝队最左,且 z 序在最上层", () => {
    const red = tugTeamHtml("red");
    const blue = tugTeamHtml("blue");
    // 红队:领队(z-index:3, scale 1)排在 left:52px
    expect(red).toMatch(/left:52px;z-index:3;transform:scale\(1\)/);
    // 蓝队镜像:领队排在 left:0px
    expect(blue).toMatch(/left:0px;z-index:3;transform:scale\(1\)/);
    // 队容器带队名 class,方便 CSS 分队上色
    expect(red).toContain("rbg-squad-red");
    expect(blue).toContain("rbg-squad-blue");
  });
});
