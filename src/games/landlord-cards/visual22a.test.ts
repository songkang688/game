/**
 * 朵朵抢地主 · 1.3 视觉升级巡检(第 22 步 A 档,只增不减)。
 *
 * 钉死三类事:
 *  1. 皮肤真的换了:--ld- token 单源落表、牌面七道工序替换便签牌、大小王换朵朵 / 星星立绘;
 *  2. 骨头一点没动:`fanLayout` 坐标快照、遮挡幕「不渲染手牌」、出牌数据先落飞行只是展示、
 *     可出牌抬升只读合法性、玩法文件对皮肤层零依赖;
 *  3. reduced 与清理:飞行 / 震动 / 呼吸全停但落桌反馈保留,FX 计时全走 later() 一把清。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SUIT_COOL, SUIT_WARM, suitPathD, type SuitId } from "../../art/kit/cardArt";
import { FLY_MAX_MS, FLY_MIN_MS, FLY_REDUCED_MS, flyFrame, startFly, stepFly } from "./anim";
import { cardWidthFor, fanLayout } from "./fan";
import { parsePlay } from "./logic";
import {
  EMBOSS_MIN_W,
  LDV_CSS,
  LD_LAYERS,
  LD_TIMING,
  LD_TOKENS,
  RING_STARS,
  bombFxPlan,
  canLiftIds,
  cardFaceArtHTML,
  curtainDecorHtml,
  embossRank,
  ldTokensCss,
  roleBadgeSvg,
  starRingHtml,
} from "./visual";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");
const visual = readFileSync(`${dir}visual.ts`, "utf8");

describe("一、token 与皮肤落表", () => {
  it("1. --ld- token 全部按规格表落进样式表,单一来源", () => {
    const css = ldTokensCss();
    const spec: Record<string, string> = {
      "--ld-felt": "#2E6B4F",
      "--ld-felt-deep": "#235240",
      "--ld-wood": "#C89B6C",
      "--ld-card": "#FFFDF6",
      "--ld-warm": "#E85D75",
      "--ld-cool": "#4A5A8F",
      "--ld-gold": "#F0C25A",
      "--ld-silver": "#C9D3DE",
      "--ld-select": "#F4859F",
      "--ld-turn-glow": "rgba(255,214,120,.3)",
    };
    for (const [k, v] of Object.entries(spec)) {
      expect(LD_TOKENS[k], `${k} 色值`).toBe(v);
      expect(css).toContain(`${k}:${v}`);
    }
    // 动效时长写成自定义属性,动画声明真的引用它们
    for (const t of ["--ldv-lift-ms", "--ldv-shake-ms", "--ldv-breath-ms", "--ldv-fade-ms", "--ldv-flip-ms", "--ldv-land-ms"]) {
      expect(css).toContain(`${t}:`);
      expect(`${LDV_CSS}${shell}`).toContain(`var(${t})`);
    }
    // 皮肤层真的拼进了 index.ts 的样式表,token 挂在 .ld-wrap 上
    expect(LDV_CSS).toContain(`.ld-wrap{${ldTokensCss()}}`);
    expect(shell).toContain("${LDV_CSS}");
  });

  it("2. 毛毡桌面 + 木沿 + 中央淡纹圆环都在样式表里", () => {
    expect(shell).toContain("linear-gradient(180deg,var(--ld-felt),var(--ld-felt-deep))");
    expect(shell).toContain("border:3px solid var(--ld-wood)");
    expect(shell).toMatch(/radial-gradient\(circle at 50% 34%,transparent 0 86px/);
    // 四角木沿:四个角各一枚圆角
    expect(shell.match(/radial-gradient\(circle at (0|100%) (0|100%),var\(--ld-wood\)/g)).toHaveLength(4);
  });

  it("3. DOM 图层序:飞牌之上是星屑层,按钮提示更高,遮挡幕盖住一切", () => {
    expect(LD_LAYERS.fly).toBeGreaterThan(LD_LAYERS.marquee);
    expect(LD_LAYERS.fx).toBeGreaterThan(LD_LAYERS.fly);
    expect(LD_LAYERS.hud).toBeGreaterThan(LD_LAYERS.fx);
    expect(LD_LAYERS.cover).toBeGreaterThan(LD_LAYERS.hud);
    expect(LDV_CSS).toContain(`z-index:${LD_LAYERS.fx}`);
    // index.ts 的既有图层(飞牌 / 框选 / 遮挡幕)也统一从 LD_LAYERS 取值
    expect(shell).toContain("z-index:${LD_LAYERS.fly}");
    expect(shell).toContain("z-index:${LD_LAYERS.marquee}");
    expect(shell).toContain("z-index:${LD_LAYERS.cover}");
  });
});

describe("二、牌面七道工序", () => {
  it("4. cardFaceHTML 不再含 🃏,大小王换成朵朵 / 星星自绘立绘 + 金银双线框", () => {
    expect(shell.includes("🃏")).toBe(false);
    expect(visual.includes("🃏")).toBe(false);
    const big = cardFaceArtHTML(53, 60);
    const small = cardFaceArtHTML(52, 60);
    expect(big).toContain("ca-joker-big");
    expect(big).toContain('data-part="flower-crown"');
    expect(big).toContain("ldv-frame-big");
    expect(small).toContain("ca-joker-small");
    expect(small).toContain('data-part="star-crown"');
    expect(small).toContain("ldv-frame-small");
    // 「王」字缎带 + 角标(扇形只露左条,角标必须在)
    expect(big).toContain("ldv-kribbon");
    expect(big).toContain("大");
    expect(small).toContain("小");
    expect(big).toContain("ld-c-i");
  });

  it("5. 四花色 SVG 两两不同,暖冷映射与对角双角标正确", () => {
    const suits: SuitId[] = ["heart", "diamond", "spade", "club"];
    expect(new Set(suits.map((s) => suitPathD(s))).size).toBe(4);
    const heart = cardFaceArtHTML(45, 60); // A♥
    const spade = cardFaceArtHTML(44, 60); // A♠
    expect(heart).toContain("ca-suit-heart");
    expect(heart).toContain(SUIT_WARM);
    expect(spade).toContain("ca-suit-spade");
    expect(spade).toContain(SUIT_COOL);
    // 左上 + 右下对角角标,内圈双线框
    expect(heart).toContain("ld-c-i");
    expect(heart).toContain("ldv-ci-br");
    expect(heart).toContain("ldv-frame");
    expect(LDV_CSS).toContain(".ldv-frame::after");
  });

  it("6. 窄屏小牌省略中心浮雕与缎带,角标与立绘保留", () => {
    const wide = cardFaceArtHTML(45, 60);
    const slim = cardFaceArtHTML(45, EMBOSS_MIN_W - 4);
    expect(wide).toContain("ldv-emboss");
    expect(slim.includes("ldv-emboss")).toBe(false);
    expect(slim).toContain("ld-c-i");
    expect(slim).toContain("ldv-ci-br");
    // 浮雕只给 10/J/Q/K/A:9 和 2(点数 15)都没有
    expect(embossRank(9)).toBe(false);
    expect(embossRank(10)).toBe(true);
    expect(embossRank(14)).toBe(true);
    expect(embossRank(15)).toBe(false);
    expect(cardFaceArtHTML(8, 60).includes("ldv-emboss")).toBe(false); // 5♠
    const slimKing = cardFaceArtHTML(53, EMBOSS_MIN_W - 4);
    expect(slimKing.includes("ldv-kribbon")).toBe(false);
    expect(slimKing).toContain("ca-joker-big");
  });
});

describe("三、骨头一点没动", () => {
  it("7. 扇形坐标换肤前后一致(fanLayout 快照钉死)", () => {
    const slots = fanLayout(17, 360, 51);
    expect(slots).toHaveLength(17);
    expect(slots[0].x).toBeCloseTo(0, 5);
    expect(slots[0].y).toBeCloseTo(17.85, 5);
    expect(slots[0].rot).toBeCloseTo(-13, 5);
    expect(slots[8].x).toBeCloseTo(154.5, 5);
    expect(slots[8].y).toBeCloseTo(0, 5);
    expect(slots[8].rot).toBeCloseTo(0, 5);
    expect(slots[16].x).toBeCloseTo(309, 5);
    expect(slots[16].y).toBeCloseTo(17.85, 5);
    expect(slots[16].rot).toBeCloseTo(13, 5);
    expect(fanLayout(1, 360, 51)).toEqual([{ x: 154.5, y: 0, rot: 0 }]);
    // 点选热区仍按「选中抬升」算,签名与调用原样
    expect(shell).toContain("hitIndex(slots, cardW, cardH, started.x, started.y, lifts)");
    expect(shell).toContain("lifts: hand.map((id) => (selected.has(id) ? lift : 0))");
  });

  it("8. 遮挡幕状态下手牌一张都不渲染(防偷看回归,最高优先级)", () => {
    const hand = shell.slice(shell.indexOf("function renderHand()"), shell.indexOf("function renderMeHead()"));
    const guard = hand.indexOf("curtainFor >= 0");
    const firstCardEl = hand.indexOf("cardEls.get(id)");
    expect(guard).toBeGreaterThan(-1);
    expect(firstCardEl).toBeGreaterThan(guard);
    const guardBlock = hand.slice(guard, hand.indexOf("ld-hidden"));
    expect(guardBlock).toContain("dropAllCardEls()");
    expect(hand.slice(guard, firstCardEl)).toContain("return;");
    // 键盘也要等幕布掀开才生效
    expect(shell).toContain("if (curtainFor >= 0) return;");
    // 幕布上只有名字 / 缎带 / 星星装饰,不带任何牌面信息
    const cover = shell.slice(shell.indexOf("function renderCover()"), shell.indexOf("function render()"));
    expect(cover.includes("cardFace")).toBe(false);
    expect(cover.includes("miniCards")).toBe(false);
    expect(cover).toContain("ldv-curtain");
    expect(cover).toContain("请交给 ${s.name}");
    expect(curtainDecorHtml().includes("ld-c-")).toBe(false);
  });

  it("9. 出牌数据先落、飞行与配菜只是展示层(时序回归)", () => {
    const c = shell.slice(shell.indexOf("function commit("), shell.indexOf("function canAct()"));
    const validate = c.indexOf("tryMove(state, cards)");
    const bail = c.indexOf("if (!res.ok) return false;");
    const fly = c.indexOf("flyCards(seat, cards, landed)");
    expect(validate).toBeGreaterThan(-1);
    expect(bail).toBeGreaterThan(validate);
    expect(fly).toBeGreaterThan(bail);
    expect(c).toContain("else flyCards(seat, cards, landed);");
    // 落桌配菜都在 landed 时刻,tableShown 的「飞到了才摆上桌」没变
    expect(c).toContain("ghostPrevHand();");
    expect(c).toContain("justLanded = true;");
    expect(c).toContain("if (boom) tableBoom();");
    expect(c).toContain("tableShown = { seat, cards: cards.slice(), passed: cards.length === 0 };");
    // 飞行时长仍由 anim 状态机管,180–240ms 规格没动
    expect(FLY_MIN_MS).toBe(180);
    expect(FLY_MAX_MS).toBe(240);
  });

  it("10. 可出牌抬升只对合法牌加类,合法性判断只读不改", () => {
    // 要压「对4」:手上的对5 合法、单3 不合法
    const prevPair4 = parsePlay([4, 5])!;
    const lift = canLiftIds([8, 9, 0], prevPair4);
    expect(lift.has(8)).toBe(true);
    expect(lift.has(9)).toBe(true);
    expect(lift.has(0)).toBe(false);
    // 一组都接不上就一张不抬;自己先手随便出,单3 也抬
    expect(canLiftIds([0], parsePlay([44, 45])!).size).toBe(0);
    expect(canLiftIds([0], null).has(0)).toBe(true);
    // index 只把结论接成 ldv-can 类 + 6px 纯展示抬升
    expect(shell).toContain("canLiftIds(hand, state.prev)");
    expect(shell).toContain('can ? " ldv-can" : ""');
    expect(shell).toContain("(can && !reduced ? LD_TIMING.liftPx : 0)");
    expect(LD_TIMING.liftPx).toBe(6);
  });

  it("11. 地主小皇冠、农民小草帽跟着身份状态走(读状态不改)", () => {
    expect(roleBadgeSvg("landlord")).toContain("ldv-crown");
    expect(roleBadgeSvg("farmer")).toContain("ldv-strawhat");
    expect(roleBadgeSvg("landlord")).not.toBe(roleBadgeSvg("farmer"));
    expect(shell).toContain('state.landlord === seat ? "landlord" : "farmer"');
    // 叫分阶段还没有地主,不挂徽章
    expect(shell).toContain('phase !== "bid" && state');
  });

  it("12. 玩法源码与规则测试对皮肤层零依赖(diff 不进玩法文件)", () => {
    for (const f of ["logic.ts", "sim.ts", "ai.ts", "levels.ts", "hint.ts", "fan.ts", "anim.ts", "fit.ts", "meta.ts", "guide.ts"]) {
      const src = readFileSync(`${dir}${f}`, "utf8");
      expect(src.includes("ldv"), `${f} 不该知道皮肤层`).toBe(false);
      expect(src.includes("./visual"), `${f} 不该 import 皮肤层`).toBe(false);
      expect(src.includes("cardArt"), `${f} 不该 import 牌面素材`).toBe(false);
    }
    for (const f of ["logic.test.ts", "sim.test.ts", "ai.test.ts", "levels.test.ts", "hint.test.ts", "fan.test.ts", "anim.test.ts", "fit.test.ts", "mercy.test.ts", "endless.test.ts"]) {
      const src = readFileSync(`${dir}${f}`, "utf8");
      expect(src.includes("visual"), `${f} 玩法测试不该被视觉步碰`).toBe(false);
    }
  });
});

describe("四、reduced 与清理", () => {
  it("13. reduced:飞行 / 震动 / 呼吸 / 渐隐不启用,落桌反馈保留", () => {
    // 飞行:reduced 分支不位移不旋转,只做短淡入(同一状态机、同一时序)
    const st = stepFly(startFly(true), 30);
    expect(startFly(true).duration).toBe(FLY_REDUCED_MS);
    const frame = flyFrame({ x: 0, y: 0 }, { x: 100, y: 50 }, 14, st);
    expect(frame.x).toBe(100);
    expect(frame.y).toBe(50);
    expect(frame.rot).toBe(0);
    // 震动:reduced 不震,星屑环保留(静态)
    expect(bombFxPlan(true)).toEqual({ shake: false, ring: true });
    expect(bombFxPlan(false)).toEqual({ shake: true, ring: true });
    // 渐隐:reduced 瞬时替换,ghost 一张影子不留
    const ghost = shell.slice(shell.indexOf("function ghostPrevHand()"), shell.indexOf("function tableBoom()"));
    expect(ghost).toContain("if (prefersReducedMotion()) return;");
    // CSS:呼吸常亮、震动 / 翻牌 / 星屑动画全停;落桌软影 ldvland 不在停用名单里
    const reduced = LDV_CSS.slice(LDV_CSS.indexOf("@media (prefers-reduced-motion:reduce)"));
    expect(reduced).toContain(".ldv-myturn{animation:none;box-shadow:0 0 14px 4px var(--ld-turn-glow);}");
    expect(reduced).toContain(".ldv-shakeboom{animation:none;}");
    expect(reduced).toContain(".ldv-flip{animation:none;}");
    expect(reduced).toContain(".ldv-fx-star{animation:none");
    expect(reduced.includes(".ldv-land{")).toBe(false);
    expect(LDV_CSS).toContain(".ldv-land{animation:ldvland var(--ldv-land-ms) steps(1,end);}");
  });

  it("14. 星屑环 8 颗四角星围一圈,反复生成结果一致(确定性)", () => {
    const ring = starRingHtml();
    expect(ring.match(/ldv-fx-star/g)).toHaveLength(RING_STARS);
    expect(RING_STARS).toBe(8);
    expect(ring).toContain("ca-star");
    expect(ring).toBe(starRingHtml());
    // 炸弹震动幅度与时长按规格表:±2px、160ms
    expect(LD_TIMING.shakePx).toBe(2);
    expect(LD_TIMING.shakeMs).toBe(160);
    expect(LD_TIMING.fadeMs).toBe(240);
    expect(LD_TIMING.flipMs).toBe(180);
    expect(LD_TIMING.breathMs).toBe(1600);
  });

  it("15. destroy 后飞行计时归零,FX 计时全走 later() 一把清", () => {
    const d = shell.slice(shell.indexOf("    destroy() {"), shell.indexOf("wrap.remove();"));
    expect(d).toContain("clearTimers();");
    expect(d).toContain("clearFlights();");
    const cf = shell.slice(shell.indexOf("function clearFlights()"), shell.indexOf("function ghostPrevHand()"));
    expect(cf).toContain("flying = 0;");
    expect(cf).toContain("flights.clear();");
    expect(cf).toContain("cancelAnimationFrame");
    // ghost / 星屑 / 震动的收尸计时没有一个裸 setTimeout:全在 timers 里,destroy 一把清
    expect([...shell.matchAll(/window\.setTimeout\(/g)]).toHaveLength(1);
    expect(shell).toContain("later(() => g.remove(), LD_TIMING.fadeMs + 40);");
    expect(shell).toContain("later(() => ring.remove(), LD_TIMING.ringMs);");
  });

  it("16. 360px:小牌兜底生效、提示气泡 ≥ 14px、按钮胶囊 ≥ 42px", () => {
    expect(cardWidthFor(360)).toBeGreaterThanOrEqual(44);
    // 360 手机保浮雕,更窄的容器才走「只留角标」兜底
    expect(cardWidthFor(360)).toBeGreaterThanOrEqual(EMBOSS_MIN_W);
    expect(cardWidthFor(322)).toBeLessThan(EMBOSS_MIN_W);
    // 提示线气泡框 + 14px(手机上也不缩回去)
    expect(shell).toMatch(/\.ldc-hintline\{font-size:14px/);
    expect(shell).toContain(".ldc-hintline::before");
    const mobile = shell.slice(shell.indexOf("@media (max-width:420px){", shell.indexOf("/* --- 1.2 新增")));
    expect(mobile).toContain(".ldc-hintline{font-size:14px;}");
    // 按钮胶囊化,热区没缩
    expect(shell).toMatch(/\.ld-btn\{border:none;border-radius:999px;min-height:44px/);
  });

  it("17. 叫分倍数牌是翻牌小卡,分数变了才翻面", () => {
    expect(shell).toContain("const flip = bidShown !== bidBest;");
    expect(shell).toContain('ldv-bid${flip ? " ldv-flip" : ""}');
    expect(LDV_CSS).toContain("animation:ldvflip var(--ldv-flip-ms) ease-in-out");
    // 轮到自己的呼吸微光挂在手牌扇容器上
    expect(shell).toContain('fanBox.classList.toggle("ldv-myturn", myTurnNow)');
    expect(LDV_CSS).toContain("animation:ldvbreath var(--ldv-breath-ms) ease-in-out infinite");
  });
});
