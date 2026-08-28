/**
 * N-37(trio-r9 测试修复员 A):管理员权限开启态挤压 quiz 族关内。
 *
 * 上游 r12 一带已经按 `:has(.l99-jump)` 的路子收过一版抬头,本轮 A 复测发现**没收住**:
 * 那一版给工具排写了 `width:100%`,反而把它顶成独占一行 ——
 *
 *   真机 Chrome 无头(localStorage 种一份 permanent 会话,四款 quiz 皮肤 × root 开/关 × 五档视口):
 *   915×412 开 root 后 `.l99-stagebar` 56 → **100px**,舞台从 134–400 缩到 178–400,
 *   math-farm 三颗答案钮整排落到舞台底下 **33px**,且宿主自滚 0 —— 够不着,也滚不出来。
 *
 * 改法:这一行别再独占。抬头整条 `flex-wrap:nowrap`,工具排改按内容宽、与题名分这一行;
 * 题名留 120px 打省略号(全挤没了家长就不知道孩子卡在哪一关),管理件自己横向滚。
 *
 * 修后同一批:915×412 抬头 100→**52px**,舞台回到 130–400,四款皮肤 线下 0 / 切半 0;
 * **root 关着时四款 × 五档逐像素与修前一致**(56 / 134–400),这条是本修法的红线,见下面的取反断言。
 * 390×844 / 412×915 / 1024×768 / 1280×800 不进这档媒体查询,开关两态全部原样。
 *
 * 权限态是一屏(r8 模式 H 的推论):修法只允许动「管理员那两件东西怎么摆」,
 * 答题判分、直达语义、跳关授权一个字不碰。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LEVEL99 = readFileSync(new URL("./level99.ts", import.meta.url), "utf8");
const QUIZ99 = readFileSync(new URL("./quiz99.ts", import.meta.url), "utf8");

/** 取出某个文件里某个媒体查询块的完整内容(括号配平) */
function mediaBlock(src: string, query: string, from = 0): string {
  const start = src.indexOf(query, from);
  expect(start, `应有 ${query}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let i = src.indexOf("{", start);
  const bodyStart = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(bodyStart, i + 1);
}

/** N-37 那一段:含 `:has(.l99-jump)` 的那个 max-height:500px 块 */
function rootShortBlock(): string {
  let from = 0;
  for (;;) {
    const at = LEVEL99.indexOf("@media (max-height:500px)", from);
    expect(at, "应有 N-37 的矮屏块").toBeGreaterThanOrEqual(0);
    const body = mediaBlock(LEVEL99, "@media (max-height:500px)", at);
    if (body.includes(":has(.l99-jump)")) return body;
    from = at + 1;
  }
}

describe("N-37 关内抬头:管理员那一行不再独占", () => {
  const short = rootShortBlock();

  it("工具排按内容宽,和题名分同一行 —— 不许再写 width:100% 把自己顶成一行", () => {
    expect(short).toMatch(/\.l99-stagebar:has\(\.l99-jump\)\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(short).toMatch(/\.l99-stagebar:has\(\.l99-jump\) \.l99-tools\s*\{[^}]*width:\s*auto/);
    expect(short).not.toMatch(/\.l99-tools\s*\{[^}]*width:\s*100%/);
  });

  it("题名留 120px 打省略号,不许挤成 0 宽", () => {
    const title = /\.l99-stagebar:has\(\.l99-jump\) \.l99-stagetitle\s*\{([^}]*)\}/.exec(short);
    expect(title, "应有题名让宽规则").not.toBeNull();
    expect(title?.[1]).toMatch(/min-width:\s*120px/);
    expect(title?.[1]).toMatch(/text-overflow:\s*ellipsis/);
    // 让的是宽,不是字号:说明文字的 16px 红线矮屏也算数
    expect(title?.[1]).not.toMatch(/font-size/);
  });

  it("关内抬头的权限小字在矮横屏收起(地图侧那句照旧显示)", () => {
    expect(short).toMatch(/\.l99-stagebar:has\(\.l99-jump\) \.l99-jump-note\s*\{\s*display:\s*none/);
    // 收的是「关内抬头里的那一份」,不是全局的 .l99-jump-note ——
    // 地图上的直达行还要靠它告诉家长权限状态
    expect(short).not.toMatch(/(?<!\.l99-stagebar:has\(\.l99-jump\) )\.l99-jump-note\s*\{\s*display:\s*none/);
  });

  it("取反:直达控件本身没被藏掉(藏了就等于把管理员功能删了)", () => {
    expect(short).not.toMatch(/\.l99-jump\s*\{[^}]*display:\s*none/);
    expect(short).not.toMatch(/\.l99-tools\s*\{[^}]*display:\s*none/);
    expect(short).not.toMatch(/\.l99-tool-skip\s*\{[^}]*display:\s*none/);
    // 挤不下就横着滚,总之够得着
    expect(short).toMatch(/\.l99-tools\s*\{[^}]*overflow-x:\s*auto/);
  });

  it("取反:凡是动抬头/舞台的都挂在 :has(.l99-jump) 上 —— root 关着时逐像素不变", () => {
    // 抬头与舞台是孩子面天天看的,这一档只准在「管理员开着」时生效。
    // (同块里 N-63 的 .l99-wrap / .l99-view 是另一条账,不归这把尺子管)
    for (const line of short.split("\n")) {
      if (!line.includes("{")) continue;
      const sel = line.split("{")[0].trim();
      if (!sel || sel.startsWith("/*") || sel.startsWith("*") || sel.startsWith("@")) continue;
      if (!/\.l99-stagebar|\.l99-stage-wrap/.test(sel)) continue;
      expect(sel, `${sel} 必须挂在 :has(.l99-jump) 上`).toContain(":has(.l99-jump)");
    }
  });

  it("媒体查询挑的是矮屏,不是窄屏 —— 竖屏手机与平板不进这一档", () => {
    expect(short).not.toMatch(/max-width/);
  });

  it("取反:抬头里的钮没被压扁去腾地方(孩子面 44px 热区红线)", () => {
    expect(short).not.toMatch(/\.l99-back/);
    expect(short).not.toMatch(/min-height:\s*(?:[0-9]|[1-3][0-9]|4[0-3])px/);
  });
});

describe("N-37 答题器:直达行浮进题号行右侧空档", () => {
  const short = mediaBlock(QUIZ99, "@media (max-height: 500px)");

  it("直达行脱离纵向流,不再从答题区身上切走一整行", () => {
    expect(short).toMatch(/\.qz-wrap:has\(\.qz-jump\) \.qz-jump\s*\{[^}]*position:\s*absolute/);
    expect(short).toMatch(/\.qz-wrap:has\(\.qz-jump\) \.qz-jump\s*\{[^}]*right:\s*0/);
  });

  it("题号行留出右内边距,「连对」那颗徽章不会被压在浮起来的那条底下", () => {
    const top = /\.qz-wrap:has\(\.qz-jump\) \.qz-top\s*\{([^}]*)\}/.exec(short);
    expect(top, "应有题号行让位规则").not.toBeNull();
    const px = /padding-right:\s*(\d+)px/.exec(top?.[1] ?? "");
    expect(px, "应留右内边距").not.toBeNull();
    // 真机量到直达那条 191–195px 宽,留位必须盖得住
    expect(Number(px?.[1])).toBeGreaterThanOrEqual(200);
  });

  it("取反:整段挂在 :has(.qz-jump) 上 —— root 关着时答题器逐像素不变", () => {
    for (const line of short.split("\n")) {
      if (!line.includes("{") || !line.includes(".qz-jump")) continue;
      const sel = line.split("{")[0].trim();
      if (!sel || sel.startsWith("/*") || sel.startsWith("*") || sel.startsWith("@")) continue;
      // .qz-jump-go 那条是 L-1 早就有的热区下限,不在本次改动范围
      if (/^\.qz-jump-(go|input)\b/.test(sel)) continue;
      expect(sel, `${sel} 必须挂在 :has(.qz-jump) 上`).toContain(":has(.qz-jump)");
    }
  });

  it("取反:直达框与确认钮仍旧是 44px 热区,没被顺手压扁去腾地方", () => {
    expect(QUIZ99).toMatch(/\.qz-jump-input\s*\{[^}]*min-height:\s*44px/);
    expect(short).toMatch(/\.qz-jump-go\s*\{[^}]*min-height:\s*44px/);
  });

  it("取反:答题交互件没被这次改动碰过(L-1 那档的 46/44px 下限还在)", () => {
    expect(short).toMatch(/\.qz-choice\s*\{[^}]*min-height:\s*46px/);
    expect(short).toMatch(/\.qz-say\s*\{[^}]*min-height:\s*44px/);
  });
});

describe("N-37 护栏:判分与直达语义零触碰", () => {
  it("答题器的判分入口还在原处", () => {
    expect(QUIZ99).toMatch(/export function runQuiz/);
    expect(QUIZ99).toMatch(/quizJumpIndex\(input\.value, questions\.length\)/);
  });

  it("直达框仍旧是 44px 热区(S-4 扩容不许被顺手回退)", () => {
    expect(QUIZ99).toMatch(/\.qz-jump-input\s*\{[^}]*min-height:\s*44px/);
  });

  it("l99 的跳关授权与直达仍旧各走各的门", () => {
    expect(LEVEL99).toMatch(/export function skipNeedsParentAuth/);
    expect(LEVEL99).toMatch(/export function rootJumpVisible/);
    // 直达只挪当前关,不写星级数组(这句注释掉了就说明有人动了语义)
    expect(LEVEL99).toMatch(/只挪当前关，星级数组与跳关标记一个字都不写/);
  });
});
