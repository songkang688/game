import { describe, expect, it } from "vitest";
import { TIER_NAMES, aiCallsOneCard, aiCatchesOneCard, aiPickColor, aiPlay, aiShouldChallenge } from "./ai";
import { buildDeck, type Card, type Color } from "./deck";
import { createGame, playCard } from "./rules";
import { duel, simulateGame } from "./sim";

const DECK = buildDeck();
function card(kind: Card["kind"], color: Color | null, num?: number): Card {
  return { ...DECK.find((c) => c.kind === kind && c.color === color && (num === undefined || c.num === num))! };
}

describe("AI 档位的性格", () => {
  it("菜鸟有什么出什么:手上第一张能出的就打", () => {
    const state = createGame({
      players: 2,
      seed: 1,
      hands: [
        [card("skip", "pink"), card("num", "pink", 4), card("num", "sky", 1)],
        [card("num", "mint", 2)],
      ],
      deck: DECK.slice(0, 12).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    const action = aiPlay(state, "rookie");
    expect(action.type).toBe("play");
    if (action.type === "play") expect(action.cardId).toBe(state.players[0].hand[0].id);
  });

  it("普通档留着功能牌,先把数字牌打出去", () => {
    const state = createGame({
      players: 2,
      seed: 1,
      hands: [
        [card("skip", "pink"), card("num", "pink", 4), card("num", "sky", 1)],
        [card("num", "mint", 2), card("num", "mint", 3)],
      ],
      deck: DECK.slice(0, 12).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    const action = aiPlay(state, "normal");
    expect(action.type).toBe("play");
    if (action.type === "play") {
      const played = state.players[0].hand.find((c) => c.id === action.cardId);
      expect(played?.kind).toBe("num");
    }
  });

  it("接不上整条链的时候只能一次抽完", () => {
    const state = createGame({
      players: 2,
      seed: 1,
      hands: [[card("draw2", "pink")], [card("num", "mint", 2), card("num", "mint", 3)]],
      deck: DECK.slice(0, 12).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    playCard(state, 0, state.players[0].hand[0].id);
    expect(aiPlay(state, "normal").type).toBe("take");
  });

  it("高手会质疑可疑的加四,菜鸟从来不质疑", () => {
    const state = createGame({
      players: 2,
      seed: 1,
      hands: [
        [
          card("wild4", null),
          card("num", "pink", 4),
          card("num", "pink", 5),
          card("num", "pink", 6),
          card("num", "pink", 8),
          card("num", "pink", 9),
        ],
        [card("num", "mint", 2), card("num", "mint", 3)],
      ],
      deck: DECK.slice(0, 20).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    playCard(state, 0, state.players[0].hand[0].id, "mint");
    expect(aiShouldChallenge(state, "expert")).toBe(true);
    expect(aiShouldChallenge(state, "hell")).toBe(true);
    expect(aiShouldChallenge(state, "rookie")).toBe(false);
    expect(aiShouldChallenge(state, "normal")).toBe(false);
    expect(aiPlay(state, "expert").type).toBe("challenge");
  });

  it("对手真的缺这个颜色时,高手不会乱质疑", () => {
    const state = createGame({
      players: 2,
      seed: 1,
      hands: [[card("wild4", null), card("num", "sky", 4)], [card("num", "mint", 2), card("num", "mint", 3)]],
      deck: DECK.slice(0, 20).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    // 对手先抽过一次粉色,大家都看见他缺粉色
    state.players[0].lacks.push("pink");
    playCard(state, 0, state.players[0].hand[0].id, "mint");
    expect(aiShouldChallenge(state, "expert")).toBe(false);
  });

  it("地狱档换色专挑下家缺的颜色", () => {
    const state = createGame({
      players: 2,
      seed: 1,
      hands: [[card("wild", null), card("num", "sky", 4)], [card("num", "mint", 2)]],
      deck: DECK.slice(0, 12).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    state.players[1].lacks.push("sky");
    expect(aiPickColor(state, "hell", [card("num", "sky", 4), card("num", "mint", 5)])).toBe("sky");
    // 普通档只看自己手上哪个颜色多
    expect(aiPickColor(state, "normal", [card("num", "mint", 5), card("num", "mint", 6), card("num", "sky", 4)])).toBe(
      "mint"
    );
  });

  it("只有高手和地狱会点破别人忘喊,菜鸟自己也记不住喊", () => {
    expect(aiCallsOneCard("rookie")).toBe(false);
    expect(aiCallsOneCard("normal")).toBe(true);
    expect(aiCatchesOneCard("normal")).toBe(false);
    expect(aiCatchesOneCard("expert")).toBe(true);
    expect(aiCatchesOneCard("hell")).toBe(true);
    expect(Object.keys(TIER_NAMES).length).toBe(4);
  });
});

describe("档位强弱", () => {
  it("固定种子下,地狱档打菜鸟档 30 局的胜率明显更高", () => {
    const report = duel("hell", "rookie", 30);
    expect(report.games).toBe(30);
    expect(report.wins[0] + report.wins[1]).toBe(30);
    expect(report.wins[0], `地狱 ${report.wins[0]} : ${report.wins[1]} 菜鸟`).toBeGreaterThanOrEqual(21);
    expect(report.wins[0]).toBeGreaterThan(report.wins[1] * 2);
  });

  it("同一个种子跑两遍,结果完全一样", () => {
    const a = simulateGame({ seats: ["hell", "normal", "expert"], seed: 555 });
    const b = simulateGame({ seats: ["hell", "normal", "expert"], seed: 555 });
    expect(a.winner).toBe(b.winner);
    expect(a.steps).toBe(b.steps);
    expect(a.scores).toEqual(b.scores);
  });

  it("一局总能打完,不会没完没了", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const res = simulateGame({ seats: ["expert", "normal", "rookie", "hell"], seed: seed * 31 });
      expect(res.steps).toBeLessThan(700);
      expect(res.winner).toBeGreaterThanOrEqual(0);
    }
  });
});
