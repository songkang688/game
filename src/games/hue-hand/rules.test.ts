import { describe, expect, it } from "vitest";
import { buildDeck, type Card, type Color } from "./deck";
import {
  RULES,
  advanceTurn,
  callOneCard,
  canPlay,
  canStack,
  challengeW4,
  chainPending,
  createGame,
  drawFromDeck,
  drawStack,
  legalPlays,
  mustTakeChain,
  oneCardPenalty,
  passAfterDraw,
  playCard,
  resolveChallenge,
  takeChain,
  topCard,
  wildDraw4Legal,
} from "./rules";

const DECK = buildDeck();

/** 挑一张标准牌出来搭测试场景 */
function card(kind: Card["kind"], color: Color | null, num?: number): Card {
  const hit = DECK.find(
    (c) => c.kind === kind && c.color === color && (num === undefined || c.num === num)
  );
  if (!hit) throw new Error(`牌堆里没有这张牌:${kind} ${color} ${num}`);
  return { ...hit };
}

/** 同一张牌再来一张(编号错开,免得和手上那张撞号) */
function twin(base: Card, id: number): Card {
  return { ...base, id };
}

describe("合法出牌", () => {
  const top = card("num", "pink", 5);

  it("颜色一样就能出", () => {
    expect(canPlay(card("num", "pink", 9), top, "pink")).toBe(true);
  });

  it("数字一样也能出", () => {
    expect(canPlay(card("num", "sky", 5), top, "pink")).toBe(true);
  });

  it("同一种功能牌能接同一种功能牌", () => {
    expect(canPlay(card("skip", "sky"), card("skip", "mint"), "mint")).toBe(true);
    expect(canPlay(card("draw2", "lemon"), card("draw2", "pink"), "pink")).toBe(true);
  });

  it("颜色和数字都对不上就出不了", () => {
    expect(canPlay(card("num", "sky", 9), top, "pink")).toBe(false);
    expect(canPlay(card("skip", "sky"), top, "pink")).toBe(false);
  });

  it("万能牌随时能出,换完颜色按新颜色接", () => {
    const wild = card("wild", null);
    expect(canPlay(wild, top, "pink")).toBe(true);
    // 万能牌落在台面上、指定了蓝色之后:蓝色的牌接得上,粉色的接不上
    expect(canPlay(card("num", "sky", 2), wild, "sky")).toBe(true);
    expect(canPlay(card("num", "pink", 2), wild, "sky")).toBe(false);
  });
});

describe("万能加四的合法性与质疑", () => {
  it("手上没有当前颜色才算合法", () => {
    const hand = [card("num", "sky", 3), card("skip", "mint")];
    expect(wildDraw4Legal(hand, "pink")).toBe(true);
    expect(wildDraw4Legal(hand, "sky")).toBe(false);
  });

  it("万能牌本身不算颜色", () => {
    expect(wildDraw4Legal([card("wild", null), card("wild4", null)], "pink")).toBe(true);
  });

  it("质疑成立:出牌者自己抽 4,加四不生效", () => {
    const out = challengeW4([card("num", "pink", 1)], "pink");
    expect(out.bluffed).toBe(true);
    expect(out.drawer).toBe("player");
    expect(out.count).toBe(4);
    expect(out.applied).toBe(false);
  });

  it("质疑失败:质疑的人抽 6", () => {
    const out = challengeW4([card("num", "sky", 1)], "pink");
    expect(out.bluffed).toBe(false);
    expect(out.drawer).toBe("challenger");
    expect(out.count).toBe(6);
    expect(out.applied).toBe(true);
  });

  it("整局里质疑成立:诈唬的人抽 4,颜色退回原来的", () => {
    const state = createGame({
      players: 2,
      seed: 1,
      hands: [[card("wild4", null), card("num", "pink", 4)], [card("num", "sky", 8)]],
      deck: DECK.slice(0, 20).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    // 手上还有粉色却硬打加四
    expect(playCard(state, 0, state.players[0].hand[0].id, "mint").ok).toBe(true);
    const res = resolveChallenge(state, 1);
    expect(res?.bluffed).toBe(true);
    expect(res?.seat).toBe(0);
    expect(res?.drawn).toBe(4);
    expect(state.players[0].hand.length).toBe(5);
    expect(state.players[1].hand.length).toBe(1);
    expect(state.color).toBe("pink");
    expect(chainPending(state)).toBe(false);
    expect(state.turn).toBe(1);
  });

  it("整局里质疑失败:质疑的人抽 6 再被跳过", () => {
    const state = createGame({
      players: 2,
      seed: 1,
      hands: [[card("wild4", null), card("num", "sky", 4)], [card("num", "sky", 8)]],
      deck: DECK.slice(0, 20).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    expect(playCard(state, 0, state.players[0].hand[0].id, "mint").ok).toBe(true);
    const res = resolveChallenge(state, 1);
    expect(res?.bluffed).toBe(false);
    expect(res?.seat).toBe(1);
    expect(res?.drawn).toBe(6);
    expect(state.players[1].hand.length).toBe(7);
    expect(state.color).toBe("mint");
    // 质疑失败要被跳过,又轮回打加四的人
    expect(state.turn).toBe(0);
  });
});

describe("叠加链", () => {
  it("加二算 2 张、加四算 4 张", () => {
    expect(drawStack([card("draw2", "pink")])).toBe(2);
    expect(drawStack([card("draw2", "pink"), card("draw2", "sky")])).toBe(4);
    expect(drawStack([card("wild4", null), card("wild4", null)])).toBe(8);
    expect(drawStack([])).toBe(0);
  });

  it("加二链与加四链不能互叠", () => {
    const chain = [card("draw2", "pink")];
    expect(canStack(chain, "draw2", card("draw2", "sky"))).toBe(true);
    expect(canStack(chain, "draw2", card("wild4", null))).toBe(false);
    const w4chain = [card("wild4", null)];
    expect(canStack(w4chain, "wild4", card("wild4", null))).toBe(true);
    expect(canStack(w4chain, "wild4", card("draw2", "pink"))).toBe(false);
    expect(RULES.CROSS_STACK).toBe(false);
  });

  it("一条链叠到上限就不许再续", () => {
    const chain = new Array(RULES.MAX_STACK).fill(0).map((_, i) => twin(card("draw2", "pink"), 500 + i));
    expect(canStack(chain, "draw2", card("draw2", "sky"))).toBe(false);
  });

  it("接不上就一次抽完整条链,而且这一家被跳过", () => {
    const state = createGame({
      players: 2,
      seed: 5,
      hands: [[card("draw2", "pink"), card("num", "pink", 1)], [card("num", "sky", 9), card("num", "mint", 3)]],
      deck: DECK.slice(0, 30).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    playCard(state, 0, state.players[0].hand[0].id);
    expect(chainPending(state)).toBe(true);
    expect(state.turn).toBe(1);
    expect(mustTakeChain(state, 1)).toBe(true);
    const got = takeChain(state, 1);
    expect(got).toBe(2);
    expect(state.players[1].hand.length).toBe(4);
    expect(chainPending(state)).toBe(false);
    // 抽完之后跳过他,又轮到出加二的人
    expect(state.turn).toBe(0);
  });

  it("手上也有加二就能续上去,整摞塞给下一家", () => {
    const state = createGame({
      players: 2,
      seed: 5,
      hands: [
        [card("draw2", "pink"), card("num", "pink", 1)],
        [twin(card("draw2", "sky"), 601), card("num", "mint", 3)],
      ],
      deck: DECK.slice(0, 30).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    playCard(state, 0, state.players[0].hand[0].id);
    expect(legalPlays(state, 1).map((c) => c.kind)).toEqual(["draw2"]);
    playCard(state, 1, 601);
    expect(drawStack(state.chain)).toBe(4);
    expect(state.turn).toBe(0);
    expect(takeChain(state, 0)).toBe(4);
  });
});

describe("方向与跳过", () => {
  it("跳过会跳掉下一家", () => {
    expect(advanceTurn({ turn: 0, dir: 1, players: 4 }, card("skip", "pink")).turn).toBe(2);
  });

  it("4 人时反转真的调头", () => {
    const next = advanceTurn({ turn: 1, dir: 1, players: 4 }, card("reverse", "pink"));
    expect(next.dir).toBe(-1);
    expect(next.turn).toBe(0);
  });

  it("2 人时反转等于跳过:还是自己出", () => {
    expect(RULES.REVERSE_IS_SKIP_AT_TWO).toBe(true);
    const next = advanceTurn({ turn: 0, dir: 1, players: 2 }, card("reverse", "pink"));
    expect(next.turn).toBe(0);
    expect(next.dir).toBe(1);
    // 跳过在 2 人局也是同一个效果
    expect(advanceTurn({ turn: 1, dir: 1, players: 2 }, card("skip", "pink")).turn).toBe(1);
  });

  it("普通牌就轮到下一家", () => {
    expect(advanceTurn({ turn: 3, dir: 1, players: 4 }, card("num", "pink", 3)).turn).toBe(0);
    expect(advanceTurn({ turn: 0, dir: -1, players: 4 }, null).turn).toBe(3);
  });
});

describe("抽牌与「就一张」", () => {
  it("抽到能出的牌可以立刻出(开关打开)", () => {
    expect(RULES.PLAY_AFTER_DRAW).toBe(true);
    const state = createGame({
      players: 2,
      seed: 3,
      hands: [[card("num", "sky", 9)], [card("num", "mint", 3), card("num", "mint", 4)]],
      deck: [card("num", "pink", 2)],
      top: card("num", "pink", 7),
      color: "pink",
    });
    const drew = drawFromDeck(state, 0);
    expect(drew.card?.num).toBe(2);
    expect(drew.playable).toBe(true);
    // 回合还留给他,可以直接把刚摸到的这张打出去
    expect(state.turn).toBe(0);
    expect(playCard(state, 0, drew.card!.id).ok).toBe(true);
  });

  it("抽到出不了的牌就换下一家", () => {
    const state = createGame({
      players: 2,
      seed: 3,
      hands: [[card("num", "sky", 9)], [card("num", "mint", 3)]],
      deck: [card("num", "mint", 6)],
      top: card("num", "pink", 7),
      color: "pink",
    });
    const drew = drawFromDeck(state, 0);
    expect(drew.playable).toBe(false);
    expect(state.turn).toBe(1);
  });

  it("摸完不想出也能直接过掉", () => {
    const state = createGame({
      players: 2,
      seed: 3,
      hands: [[card("num", "sky", 9)], [card("num", "mint", 3)]],
      deck: [card("num", "pink", 2)],
      top: card("num", "pink", 7),
      color: "pink",
    });
    drawFromDeck(state, 0);
    expect(passAfterDraw(state, 0)).toBe(true);
    expect(state.turn).toBe(1);
  });

  it("忘按「就一张」被点破,罚抽 2 张", () => {
    const state = createGame({
      players: 2,
      seed: 9,
      hands: [[card("num", "pink", 1), card("num", "pink", 2)], [card("num", "sky", 3)]],
      deck: DECK.slice(0, 12).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    playCard(state, 0, state.players[0].hand[0].id);
    expect(state.oneCard?.player).toBe(0);
    const res = oneCardPenalty(state, 0);
    expect(res.penalized).toBe(true);
    expect(res.drawn).toBe(RULES.ONE_CARD_PENALTY);
    expect(res.drawn).toBe(2);
    expect(state.players[0].hand.length).toBe(3);
  });

  it("按过「就一张」就罚不到他", () => {
    const state = createGame({
      players: 2,
      seed: 9,
      hands: [[card("num", "pink", 1), card("num", "pink", 2)], [card("num", "sky", 3)]],
      deck: DECK.slice(0, 12).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    playCard(state, 0, state.players[0].hand[0].id);
    expect(callOneCard(state, 0)).toBe(true);
    expect(oneCardPenalty(state, 0)).toEqual({ penalized: false, drawn: 0 });
    expect(state.players[0].hand.length).toBe(1);
  });

  it("手上不是一张的时候按了也不算数", () => {
    const state = createGame({ players: 2, seed: 4 });
    expect(callOneCard(state, 0)).toBe(false);
  });
});

describe("一局的开始与结束", () => {
  it("开局每人 7 张,台面上是一张数字牌", () => {
    const state = createGame({ players: 4, seed: 12 });
    expect(state.players.length).toBe(4);
    for (const p of state.players) expect(p.hand.length).toBe(RULES.START_HAND);
    expect(topCard(state).kind).toBe("num");
    expect(state.deck.length).toBe(108 - 4 * 7 - 1);
  });

  it("出不了的牌会被温柔地挡回来", () => {
    const state = createGame({
      players: 2,
      seed: 2,
      hands: [[card("num", "sky", 9)], [card("num", "mint", 3)]],
      deck: DECK.slice(0, 10).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    const res = playCard(state, 0, state.players[0].hand[0].id);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("换一张");
    expect(state.players[0].hand.length).toBe(1);
  });

  it("还没轮到你就出不了牌", () => {
    const state = createGame({ players: 2, seed: 2 });
    const res = playCard(state, 1, state.players[1].hand[0].id);
    expect(res.ok).toBe(false);
  });

  it("先出完手牌的人赢下这一局", () => {
    const state = createGame({
      players: 2,
      seed: 2,
      hands: [[card("num", "pink", 9)], [card("num", "mint", 3), card("num", "mint", 4)]],
      deck: DECK.slice(0, 10).map((c) => ({ ...c })),
      top: card("num", "pink", 7),
      color: "pink",
    });
    const res = playCard(state, 0, state.players[0].hand[0].id);
    expect(res.won).toBe(true);
    expect(state.finished).toBe(true);
    expect(state.winner).toBe(0);
  });

  it("牌堆抽空了会把打出去的牌洗回来接着用", () => {
    const state = createGame({
      players: 2,
      seed: 6,
      hands: [[card("num", "sky", 9)], [card("num", "mint", 3)]],
      deck: [],
      top: card("num", "pink", 7),
      color: "pink",
    });
    // 台面已经有好几张打出去的牌,抽牌堆是空的
    state.pile = [card("num", "pink", 1), card("num", "pink", 2), card("num", "pink", 7)];
    const drew = drawFromDeck(state, 0);
    expect(drew.card).not.toBeNull();
    expect(state.pile.length).toBe(1);
  });
});
