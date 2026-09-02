/**
 * 朵朵大战星星 · 1.3 视觉契约测试。
 *
 * 1.3 只改画面不改玩法，这里锁住的是「画面确实换掉了 emoji 占位」这件事：
 *  1. 12 位角色全员有专属脸谱，朵朵和星星的绘制序列不同（角色可分辨）；
 *  2. 对局画面的 fillText 里再也不许出现任何 emoji（角色脸 / 💫 / ⭐ / ☁️ 全下岗）；
 *  3. 道具是「泡壳 + 图标」，泡壳必须有径向渐变（不是纯白圆）；
 *  4. 出界星星是五角星路径绘制，不是 "⭐" 字符；
 *  5. 弱动效口径：animT / tiltAngle 在 soft=true 时恒为 0。
 *
 * 跑在 node 环境（无 jsdom），画笔用一个记录所有调用的 Proxy 桩。
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  FACE_IDS,
  ITEM_CATS,
  TEAM_DASH,
  animT,
  drawBelt,
  drawCharBody,
  drawCharFace,
  drawCracks,
  drawFluffyCloud,
  drawGoldStar,
  drawHiddenPlatform,
  drawIceDetail,
  drawItem,
  drawItemBubble,
  drawItemIcon,
  drawPlatformBase,
  drawSparkle,
  drawSprings,
  drawMidgroundBand,
  drawStageDecor,
  drawSyrupBubbles,
  drawTeamRing,
  shade,
  starPath,
  tiltAngle,
  type FaceMood,
} from "./art";
import { ROSTER } from "./roster";
import { STAGES, WORLD_H, WORLD_W } from "./stages";
import { ITEMS } from "./items";
import { findButton, install, type FakeCtx, type Harness } from "./domStub";

/* ------------------------------------------------------------------ */
/* 记录型画笔桩                                                          */
/* ------------------------------------------------------------------ */

interface Call {
  fn: string;
  args: unknown[];
}

/** 把每一次方法调用和属性赋值都记下来的 2D 画笔桩 */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const grad = { addColorStop: (): void => {} };
  const base: Record<string, unknown> = {};
  const proxy = new Proxy(base, {
    get(t, prop) {
      const key = String(prop);
      if (!(key in t)) {
        t[key] = (...args: unknown[]): unknown => {
          calls.push({ fn: key, args });
          if (key.startsWith("create")) return grad;
          if (key === "measureText") return { width: 10 };
          return undefined;
        };
      }
      return t[key];
    },
    set(t, prop, value) {
      calls.push({ fn: `set ${String(prop)}`, args: [value] });
      t[String(prop)] = value;
      return true;
    },
  });
  return { ctx: proxy as unknown as CanvasRenderingContext2D, calls };
}

function names(calls: Call[]): string[] {
  return calls.map((c) => c.fn);
}

/** 有没有真的画东西（fill / stroke / fillRect 至少来一次） */
function painted(calls: Call[]): boolean {
  const n = names(calls);
  return n.includes("fill") || n.includes("stroke") || n.includes("fillRect");
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

/* ------------------------------------------------------------------ */
/* 1. 角色脸谱                                                          */
/* ------------------------------------------------------------------ */

describe("角色脸谱系统", () => {
  it("roster 全员 id 都有非空脸谱，小尺寸 r=16 也画得出来", () => {
    for (const f of ROSTER) {
      for (const r of [22, 16]) {
        const rec = recorder();
        drawCharFace(rec.ctx, f.id, 100, 100, r, "idle", 0);
        expect(painted(rec.calls), `${f.id} r=${r} 的脸谱是空的`).toBe(true);
      }
    }
  });

  it("朵朵与星星的绘制序列不同（两位主角一眼可分辨）", () => {
    const a = recorder();
    drawCharFace(a.ctx, "duoduo", 100, 100, 22, "idle", 0);
    const b = recorder();
    drawCharFace(b.ctx, "xingxing", 100, 100, 22, "idle", 0);
    expect(JSON.stringify(a.calls)).not.toBe(JSON.stringify(b.calls));
  });

  it("12 位角色的脸谱序列两两不同（不是换色偷懒）", () => {
    const seen = new Set<string>();
    for (const f of ROSTER) {
      const rec = recorder();
      drawCharFace(rec.ctx, f.id, 100, 100, 22, "idle", 0);
      seen.add(JSON.stringify(rec.calls));
    }
    expect(seen.size).toBe(ROSTER.length);
  });

  it("脸谱只用路径绘制，任何表情都不写字、更不贴 emoji", () => {
    const moods: FaceMood[] = ["idle", "attack", "hurt", "dizzy", "happy"];
    for (const f of ROSTER) {
      for (const mood of moods) {
        const rec = recorder();
        drawCharFace(rec.ctx, f.id, 100, 100, 22, mood, 0);
        expect(names(rec.calls)).not.toContain("fillText");
      }
    }
  });

  it("FACE_IDS 覆盖 roster 全员，主角 A/B 主色不同（双通道之一）", () => {
    for (const f of ROSTER) {
      expect(FACE_IDS).toContain(f.id);
    }
    const duo = ROSTER.find((f) => f.id === "duoduo");
    const xing = ROSTER.find((f) => f.id === "xingxing");
    expect(duo?.color).not.toBe(xing?.color);
  });

  it("身体是三层（渐变 + 阴影弧 + 描边），队伍外环 4 种线型互不相同", () => {
    const rec = recorder();
    drawCharBody(rec.ctx, "#ff9ec4", 100, 100, 22);
    expect(names(rec.calls)).toContain("createRadialGradient");
    expect(names(rec.calls).filter((n) => n === "fill").length).toBeGreaterThanOrEqual(2);
    expect(names(rec.calls)).toContain("stroke");

    // 色弱可读：外环靠「颜色 + 虚实线型」双通道，4 队线型必须两两不同
    expect(new Set(TEAM_DASH.map((d) => JSON.stringify(d))).size).toBe(4);
    const ring = recorder();
    drawTeamRing(ring.ctx, "#7fb2ff", 1, 100, 100, 26);
    expect(names(ring.calls)).toContain("setLineDash");
  });
});

/* ------------------------------------------------------------------ */
/* 2. 道具泡壳与图标                                                     */
/* ------------------------------------------------------------------ */

describe("道具绘制化（14 种全换）", () => {
  it("每种道具的泡壳都有径向渐变（不是纯白圆）", () => {
    for (const item of ITEMS) {
      const rec = recorder();
      drawItem(rec.ctx, item.id, 100, 100, 17);
      expect(names(rec.calls), `${item.id} 的泡壳没有渐变`).toContain("createRadialGradient");
      expect(painted(rec.calls)).toBe(true);
    }
  });

  it("14 种图标两两不同，且全部有类别描边色（攻/移/护）", () => {
    const seen = new Set<string>();
    for (const item of ITEMS) {
      const rec = recorder();
      drawItemIcon(rec.ctx, item.id, 100, 100, 10);
      expect(painted(rec.calls), `${item.id} 的图标是空的`).toBe(true);
      seen.add(JSON.stringify(rec.calls));
      expect(ITEM_CATS[item.id], `${item.id} 没归进攻/移/护类别`).toBeTruthy();
    }
    expect(seen.size).toBe(ITEMS.length);
  });

  it("泡壳三类描边色互不相同", () => {
    const strokes = (["attack", "move", "guard"] as const).map((cat) => {
      const rec = recorder();
      drawItemBubble(rec.ctx, cat, 100, 100, 17);
      const set = rec.calls.filter((c) => c.fn === "set strokeStyle");
      return JSON.stringify(set.map((c) => c.args[0]));
    });
    expect(new Set(strokes).size).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/* 3. 星星粒子与平台画法                                                 */
/* ------------------------------------------------------------------ */

describe("星星粒子与平台", () => {
  it("出界星星是五角星路径（moveTo/lineTo ≥ 10 段），不是 \"⭐\" 字符", () => {
    const rec = recorder();
    drawGoldStar(rec.ctx, 100, 100, 8, 0.5);
    const n = names(rec.calls);
    expect(n).not.toContain("fillText");
    expect(n.filter((x) => x === "moveTo" || x === "lineTo").length).toBeGreaterThanOrEqual(10);
    expect(n).toContain("closePath");
    expect(n).toContain("fill");

    const path = recorder();
    starPath(path.ctx, 0, 0, 10, 0);
    expect(names(path.calls)).toContain("closePath");
  });

  it("r2 W4R1-07:金星有独立白高光第三层(渐变+描边+高光,与全库金星规格对齐)", () => {
    const rec = recorder();
    drawGoldStar(rec.ctx, 100, 100, 8, 0.5);
    const n = names(rec.calls);
    expect(n).toContain("ellipse");
    expect(n.filter((x) => x === "fill").length).toBeGreaterThanOrEqual(2);
    const fills = rec.calls.filter((c) => c.fn === "set fillStyle").map((c) => String(c.args[0]));
    expect(fills.some((f) => f.startsWith("rgba(255,255,255"))).toBe(true);
  });

  it("r2 W4R1-04:主角双人头饰比例钉在放大档(星呆毛 0.5r/花瓣 0.24r),16px 不许再缩", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./art.ts", import.meta.url), "utf8");
    expect(src).toMatch(/drawGoldStar\(ctx, x, y - r \* 1\.18, r \* 0\.5, 0\.35\)/);
    expect(src).toMatch(/r \* 0\.34, cy \+ Math\.sin\(a\) \* r \* 0\.34, r \* 0\.24/);
    // r2 W4R2-03 补刀:与星呆毛最难分的啾啾弧呆毛也钉在放大档(0.34r,线宽 0.14r)
    expect(src).toMatch(/arc\(x, y - r \* 1\.08, r \* 0\.34, Math\.PI \* 0\.85/);
    expect(src).toMatch(/Math\.max\(1\.6, r \* 0\.14\)/);
  });

  it("4 芒闪光与蓬蓬云都是非空绘制（等待重生的 ☁️ 字符下岗）", () => {
    const sp = recorder();
    drawSparkle(sp.ctx, 0, 0, 8);
    expect(painted(sp.calls)).toBe(true);
    const cl = recorder();
    drawFluffyCloud(cl.ctx, 0, 0, 64);
    expect(names(cl.calls).filter((n) => n === "fill").length).toBeGreaterThanOrEqual(2);
  });

  it("平台通用画法有顶面高光与底面投影（≥3 次填充），机制画法各自非空", () => {
    const base = recorder();
    drawPlatformBase(base.ctx, 100, 400, 200, 24, "#ffe3f0");
    expect(names(base.calls).filter((n) => n === "fill").length).toBeGreaterThanOrEqual(3);

    // 传送带是绘制的箭头齿带，不再是 "▶▶▶" 字符
    const belt = recorder();
    drawBelt(belt.ctx, 100, 400, 200, 24, 70, 1.2);
    expect(names(belt.calls)).toContain("clip");
    expect(names(belt.calls)).toContain("stroke");
    expect(names(belt.calls)).not.toContain("fillText");

    const spring = recorder();
    drawSprings(spring.ctx, 100, 400, 200, 24);
    expect(painted(spring.calls)).toBe(true);
    const ice = recorder();
    drawIceDetail(ice.ctx, 100, 400, 200, 24);
    expect(painted(ice.calls)).toBe(true);
    const crack = recorder();
    drawCracks(crack.ctx, 100, 400, 200, 24, 3);
    expect(painted(crack.calls)).toBe(true);

    // 隐形平台：虚线轮廓 + 微光
    const hidden = recorder();
    drawHiddenPlatform(hidden.ctx, 100, 400, 200, 24);
    expect(names(hidden.calls)).toContain("setLineDash");
  });

  it("10 张场地的装饰层都能画（糖浆池的细节在气泡函数里）", () => {
    expect(STAGES.length).toBe(10);
    for (const s of STAGES) {
      const rec = recorder();
      drawStageDecor(rec.ctx, s.id, WORLD_W, WORLD_H, 1.5, s.sky[0]);
      if (s.id === "syrup-pool") continue;
      expect(painted(rec.calls), `${s.id} 的装饰层是空的`).toBe(true);
    }
    const bub = recorder();
    drawSyrupBubbles(bub.ctx, 400, WORLD_H, 2);
    expect(painted(bub.calls)).toBe(true);
  });

  it("装饰层在 t=0（soft 定格）下输出确定的一帧：同参两次序列一致", () => {
    for (const s of STAGES) {
      const a = recorder();
      const b = recorder();
      drawStageDecor(a.ctx, s.id, WORLD_W, WORLD_H, 0, s.sky[0]);
      drawStageDecor(b.ctx, s.id, WORLD_W, WORLD_H, 0, s.sky[0]);
      expect(JSON.stringify(a.calls)).toBe(JSON.stringify(b.calls));
    }
  });

  it("r2 B档TOP4:10 张场地的中景剪影带非空且两两不同(静态确定,一次填充)", () => {
    const seen = new Set<string>();
    for (const s of STAGES) {
      const rec = recorder();
      drawMidgroundBand(rec.ctx, s.id, WORLD_W, WORLD_H, s.sky[1]);
      expect(painted(rec.calls), `${s.id} 的剪影带是空的`).toBe(true);
      expect(names(rec.calls)).not.toContain("fillText");
      const key = JSON.stringify(rec.calls.filter((c) => c.fn !== "set fillStyle"));
      seen.add(key);
      // 静态确定性:同参两次一致
      const again = recorder();
      drawMidgroundBand(again.ctx, s.id, WORLD_W, WORLD_H, s.sky[1]);
      expect(JSON.stringify(again.calls)).toBe(JSON.stringify(rec.calls));
    }
    expect(seen.size, "有场地的剪影带撞形了").toBe(STAGES.length);
  });
});

/* ------------------------------------------------------------------ */
/* 4. 弱动效口径与颜色工具                                               */
/* ------------------------------------------------------------------ */

describe("弱动效与颜色", () => {
  it("soft=true 时动画参数恒为 0：animT / tiltAngle 全部归零", () => {
    expect(animT(5, true)).toBe(0);
    expect(animT(123.4, true)).toBe(0);
    expect(animT(5, false)).toBe(5);
    expect(tiltAngle(500, true)).toBe(0);
    expect(tiltAngle(-500, true)).toBe(0);
    expect(tiltAngle(240, false)).toBeGreaterThan(0);
  });

  it("倾斜角上限 8°，方向跟速度走", () => {
    const max = (8 * Math.PI) / 180;
    expect(tiltAngle(99999, false)).toBeLessThanOrEqual(max + 1e-9);
    expect(tiltAngle(-99999, false)).toBeGreaterThanOrEqual(-max - 1e-9);
    expect(tiltAngle(-120, false)).toBeLessThan(0);
  });

  it("shade 输出合法 #rrggbb，变亮变暗方向正确", () => {
    const lighter = shade("#ff9ec4", 0.12);
    const darker = shade("#ff9ec4", -0.25);
    expect(lighter).toMatch(/^#[0-9a-f]{6}$/);
    expect(darker).toMatch(/^#[0-9a-f]{6}$/);
    expect(parseInt(lighter.slice(1, 3), 16)).toBeGreaterThanOrEqual(0xff - 1);
    expect(parseInt(darker.slice(1, 3), 16)).toBeLessThan(0xff);
  });
});

/* ------------------------------------------------------------------ */
/* 5. 实战挂载：对局画面里一个 emoji 都不许再写                            */
/* ------------------------------------------------------------------ */

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

async function mountGame(h: Harness): Promise<{ destroy: () => void }> {
  const mod = await import("./index");
  return mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    addStars: () => {},
  } as never);
}

describe("对局画面契约", () => {
  it("双人对战打满几百帧（含走近、互殴），fillText 里没有任何 emoji", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);
    findButton(h.root, "双人对战")?.fire("click");
    const go = findButton(h.root, "开打");
    expect(go, "双人对战里没有开打按钮").not.toBeNull();
    go?.fire("click");

    const canvas = h.root.querySelector("canvas");
    expect(canvas, "擂台上没有画布").not.toBeNull();
    const ctx = canvas?.getContext("2d") as FakeCtx;
    const texts: string[] = [];
    ctx.fillText = ((s: unknown): void => {
      texts.push(String(s));
    }) as never;

    // 两人相向走近，然后互相出招（轻击 + 重击都来一轮）
    h.key("keydown", "KeyD");
    h.key("keydown", "ArrowLeft");
    h.flush(140);
    h.key("keyup", "KeyD");
    h.key("keyup", "ArrowLeft");
    for (let i = 0; i < 24; i++) {
      h.key("keydown", i % 2 === 0 ? "KeyF" : "KeyG");
      h.flush(4);
      h.key("keyup", i % 2 === 0 ? "KeyF" : "KeyG");
      h.key("keydown", i % 2 === 0 ? "KeyL" : "KeyK");
      h.flush(4);
      h.key("keyup", i % 2 === 0 ? "KeyL" : "KeyK");
      h.flush(4);
    }
    h.flush(120);

    // 画面一直在写元气数字等文字，但一个 emoji 都不许有；
    // 元气数字出现过大于 0 的值，说明真打中了，命中演出那条路也走过了
    expect(texts.length).toBeGreaterThan(0);
    expect(
      texts.some((s) => /^[1-9]\d*$/.test(s)),
      "打了几十招元气还全是 0，互殴没发生"
    ).toBe(true);
    for (const s of texts) {
      expect(EMOJI_RE.test(s), `画布上出现了 emoji：「${s}」`).toBe(false);
    }
    for (const f of ROSTER) {
      expect(texts.some((s) => s.includes(f.emoji)), `角色 emoji ${f.emoji} 还在画布上`).toBe(false);
    }
    for (const bad of ["⭐", "💫", "☁️", "▶▶▶", "◀◀◀"]) {
      expect(texts.some((s) => s.includes(bad)), `占位字符 ${bad} 还在画布上`).toBe(false);
    }
    game.destroy();
  });

  it("弱动效（prefers-reduced-motion）下同样开局作画，不抛异常", async () => {
    const h = install({ reduceMotion: true });
    harness = h;
    const game = await mountGame(h);
    findButton(h.root, "双人对战")?.fire("click");
    findButton(h.root, "开打")?.fire("click");
    const ctx = h.root.querySelector("canvas")?.getContext("2d") as FakeCtx;
    const texts: string[] = [];
    ctx.fillText = ((s: unknown): void => {
      texts.push(String(s));
    }) as never;
    h.flush(90);
    expect(texts.length).toBeGreaterThan(0);
    for (const s of texts) {
      expect(EMOJI_RE.test(s)).toBe(false);
    }
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
  });
});
