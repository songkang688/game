import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HINT_MODES,
  HINT_MODE_NAMES,
  PASS_BUTTON_LABEL,
  PASS_WORD,
  groupsSummary,
  nextHintMode,
  playableGroups,
  rankCandidates,
  searchHint,
  type HintInput,
} from "./hint";
import { splitCount } from "./ai";
import { BIG_JOKER, SMALL_JOKER, beats, parsePlay, type Play } from "./logic";

const RANK_OF: Record<string, number> = {
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  "2": 15,
  w: 16,
  W: 17,
};

function cards(spec: string): number[] {
  const used = new Map<number, number>();
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const r = RANK_OF[tok];
      if (r === undefined) throw new Error(`看不懂的牌:${tok}`);
      const n = used.get(r) ?? 0;
      used.set(r, n + 1);
      if (r === 16) return SMALL_JOKER;
      if (r === 17) return BIG_JOKER;
      return (r - 3) * 4 + n;
    });
}

function play(spec: string): Play {
  const p = parsePlay(cards(spec));
  if (!p) throw new Error(`应该是合法牌型:${spec}`);
  return p;
}

function inputOf(over: Partial<HintInput> & { hand: number[] }): HintInput {
  return {
    prev: null,
    seat: 1,
    landlord: 0,
    counts: [12, over.hand.length, 12],
    ...over,
  };
}

/** 把「看了 N 种走法」里的 N 抠出来,用来验证话里的数字不是编的 */
function searchedInText(text: string): number | null {
  const m = /看了 (\d+) 种(走法|压法)/.exec(text) ?? /搜了 (\d+) 种(走法|压法)/.exec(text);
  return m ? Number(m[1]) : null;
}

describe("牌力提示三档", () => {
  it("三档按「关 → 高亮牌组 → 推荐一手」循环,每一档都有名字", () => {
    expect(HINT_MODES).toEqual(["off", "groups", "coach"]);
    expect(nextHintMode("off")).toBe("groups");
    expect(nextHintMode("groups")).toBe("coach");
    expect(nextHintMode("coach")).toBe("off");
    for (const m of HINT_MODES) expect(HINT_MODE_NAMES[m].length).toBeGreaterThan(2);
  });

  it("关档什么都不算:不给推荐、不给候选,搜索次数是 0", () => {
    const res = searchHint(inputOf({ hand: cards("3 4 5 6 7 9 9") }), "off");
    expect(res.play).toBeNull();
    expect(res.ranked).toHaveLength(0);
    expect(res.searched).toBe(0);
  });

  it("高亮档只圈牌组不替你决定:给出候选但不给推荐", () => {
    const res = searchHint(inputOf({ hand: cards("3 4 5 6 7 9 9") }), "groups");
    expect(res.play).toBeNull();
    expect(res.ranked.length).toBeGreaterThan(3);
    expect(res.searched).toBe(res.ranked.length);
    expect(res.reason).toContain(`${res.ranked.length} 组`);
  });

  it("高亮档给出的每一组都真的能出", () => {
    const hand = cards("3 3 9 10 J Q K A 2 w W");
    const prev = play("8");
    for (const p of playableGroups(hand, prev)) {
      expect(p.cards.every((id) => hand.includes(id))).toBe(true);
      expect(parsePlay(p.cards)).not.toBeNull();
      expect(beats(p, prev)).toBe(true);
    }
  });

  it("高亮档的牌组不重复,接不上时直接说清楚", () => {
    const list = playableGroups(cards("3 4 5 6 7 8 9"), null);
    expect(new Set(list.map((p) => p.cards.join(","))).size).toBe(list.length);
    expect(groupsSummary([])).toContain(PASS_WORD);
  });

  it("教练档推荐的一定是手里的牌,而且是合法牌型", () => {
    const hand = cards("3 3 4 5 6 7 8 9 9 9 J Q K A 2 w W");
    const res = searchHint(inputOf({ hand }), "coach");
    expect(res.play).not.toBeNull();
    expect(res.play!.cards.every((id) => hand.includes(id))).toBe(true);
    expect(parsePlay(res.play!.cards)).not.toBeNull();
  });

  it("理由里的「看了几种走法」就是这次真的搜过的数量,不是写死的", () => {
    for (const spec of ["3 4 5 6 7 9 9 K 2", "3 3 3 4 4 4 7 8 2 w W", "5 6 7 8 9 10 J Q"]) {
      const res = searchHint(inputOf({ hand: cards(spec) }), "coach");
      expect(res.searched).toBe(res.ranked.length);
      expect(searchedInText(res.reason)).toBe(res.searched);
    }
  });

  it("理由里的「打完还剩几手」和真实拆牌手数对得上", () => {
    const hand = cards("3 4 5 6 7 9 9 K 2");
    const res = searchHint(inputOf({ hand }), "coach");
    const best = res.ranked[0];
    const rest = hand.filter((id) => !best.play.cards.includes(id));
    expect(best.restHands).toBe(splitCount(rest));
    const m = /降到 (\d+) 手|还是 (\d+) 手/.exec(res.reason);
    if (m) expect(Number(m[1] ?? m[2])).toBe(best.restHands);
  });

  it("一把能走完就推荐一把走完,并说明这是最快的", () => {
    const res = searchHint(inputOf({ hand: cards("3 4 5 6 7") }), "coach");
    expect(res.play?.cards).toHaveLength(5);
    expect(res.reason).toContain("收掉");
  });

  it("先手时会推荐先出小牌探路,而不是一上来甩大牌", () => {
    const res = searchHint(inputOf({ hand: cards("3 6 8 10 Q K A 2 w W") }), "coach");
    expect(res.play).not.toBeNull();
    expect(res.play!.main).toBeLessThan(15);
  });

  it("跟牌时推荐的一手真的压得住上家", () => {
    const prev = play("9 9");
    const res = searchHint(inputOf({ hand: cards("3 3 10 10 K K 2 2 5 7"), prev }), "coach");
    expect(res.play).not.toBeNull();
    expect(beats(res.play!, prev)).toBe(true);
  });

  it("只有炸弹压得住、对手又不急的时候,教练会建议先过一手并说明原因", () => {
    const res = searchHint(
      inputOf({ hand: cards("3 3 3 3 4 6 8 10 Q"), prev: play("A"), counts: [11, 9, 10] }),
      "coach"
    );
    expect(res.pass).toBe(true);
    expect(res.play).toBeNull();
    expect(res.reason).toContain("炸");
    expect(searchedInText(res.reason)).toBe(res.searched);
  });

  it("一手都压不住时直接劝过牌,不硬编一个不存在的走法", () => {
    const res = searchHint(inputOf({ hand: cards("3 4 5"), prev: play("A") }), "coach");
    expect(res.play).toBeNull();
    expect(res.pass).toBe(true);
    expect(res.searched).toBe(0);
  });

  it("候选是按局面分从好到差排的,推荐的就是排头那一手", () => {
    const ranked = rankCandidates(inputOf({ hand: cards("3 3 4 5 6 7 8 9 9 9 J Q K A 2") }));
    for (let i = 1; i < ranked.length; i++) expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i - 1].score);
    const res = searchHint(inputOf({ hand: cards("3 3 4 5 6 7 8 9 9 9 J Q K A 2") }), "coach");
    expect(res.play?.cards).toEqual(ranked[0].play.cards);
  });

  it("同一个局面搜两次,推荐和理由一模一样(确定性搜索)", () => {
    const mk = (): HintInput => inputOf({ hand: cards("3 3 4 5 6 7 8 9 9 9 J Q K A 2 w W") });
    expect(searchHint(mk(), "coach")).toEqual(searchHint(mk(), "coach"));
  });

  it("换一个局面就换一套说法:理由不是同一句模板套出来的", () => {
    const a = searchHint(inputOf({ hand: cards("3 4 5 6 7 9 9 K") }), "coach");
    const b = searchHint(inputOf({ hand: cards("3 3 3 3 K K K K w W") }), "coach");
    expect(a.reason).not.toBe(b.reason);
    expect(a.searched).not.toBe(b.searched);
  });

  it("提示的每一句都不带责备,也不沾赌博的说法", () => {
    const specs = ["3 4 5 6 7 9 9 K", "3 3 3 3 4 6", "5 6 7 8 9 10 J Q 2 w W"];
    for (const spec of specs) {
      for (const mode of HINT_MODES) {
        const res = searchHint(inputOf({ hand: cards(spec) }), mode);
        expect(res.reason).not.toMatch(/错|不行|笨|下注|赌|筹码|赔率|充值/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// W5R3-A-01：提示让孩子按的那颗键，牌桌上必须真有这个名字
// ---------------------------------------------------------------------------

describe("提示里点名的按钮和牌桌上那颗是同一个字", () => {
  const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

  it("过牌键的字面由 hint.ts 一处说了算,牌桌不再自己写死一份", () => {
    expect(PASS_WORD).toBe("不出");
    expect(PASS_BUTTON_LABEL).toContain(PASS_WORD);
    // 牌桌那颗键必须用常量拼，不许再出现写死的字面
    expect(SRC).toContain("mkBtn(PASS_BUTTON_LABEL");
    expect(SRC).not.toContain('mkBtn("🙅 不出"');
  });

  it("三句劝过牌的提示都点「不出」,一句都不许再说「不要」", () => {
    // 一组都接不上（groups 档）
    expect(groupsSummary([])).toContain(`「${PASS_WORD}」`);
    // 一种压法都搜不到（coach 档，prev 存在）
    const none = searchHint(inputOf({ hand: cards("3 4 5"), prev: play("A") }), "coach");
    expect(none.pass).toBe(true);
    expect(none.reason).toContain(`「${PASS_WORD}」`);
    // 全档全局面扫一遍：只要提到过牌键，就得是「不出」
    const specs = ["3 4 5", "3 4 5 6 7 9 9 K", "3 3 3 3 4 6", "5 6 7 8 9 10 J Q 2 w W"];
    for (const spec of specs) {
      for (const prev of [null, play("A"), play("2")]) {
        for (const mode of HINT_MODES) {
          const res = searchHint(inputOf({ hand: cards(spec), prev }), mode);
          expect(res.reason, `${spec} / ${mode}`).not.toContain("「不要」");
        }
      }
    }
  });

  it("hint.ts 正文里一句写死的「不要」都不剩", () => {
    const hintSrc = readFileSync(new URL("./hint.ts", import.meta.url), "utf8");
    const code = hintSrc
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//") && !l.includes("/**"))
      .join("\n");
    expect(code).not.toContain("「不要」");
  });

  /*
   * W5R3-A-01 只改了 `hint.ts`，守门也只盯 `hint.ts`——第 3 轮测试员 A13 在
   * `index.ts` 里又找出三处**给孩子看的**「不要」（`W5R3-TA-04`）：
   *   :399 键位提示「G 不要」（牌桌底下那颗键印的是「🙅 不出」）
   *   :622 对家气泡「不要～」   :663 牌桌流水「不要～」
   * 第一处最要紧——它是在**教孩子这颗键叫什么**。扫描范围一并扩到 `index.ts`。
   */
  it("index.ts 里给孩子看的字也一句「不要」都不剩（W5R3-TA-04）", () => {
    // 只看会被渲染出来的那些：注释里解释缘由的那几句不算
    const code = SRC.split("\n")
      .filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*") && !l.includes("/**");
      })
      .join("\n");
    expect(code).not.toContain("不要");
    // 三处都改成了由常量拼，以后 PASS_WORD 一改这三处跟着走
    expect(SRC).toContain("${k.pass.toUpperCase()} ${PASS_WORD}");
    expect(SRC).toContain('<span class="ld-bubble">${PASS_WORD}～</span>');
    expect(SRC).toContain('<span class="ldc-table-pass">${PASS_WORD}～</span>');
  });

  it("键位提示上印的就是牌桌底下那颗键上的字", () => {
    const at = SRC.indexOf("function keyHint(seat: SeatCfg): string {");
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf("\n}", at));
    expect(body).toContain("PASS_WORD");
    expect(PASS_BUTTON_LABEL).toContain(PASS_WORD);
  });
});
