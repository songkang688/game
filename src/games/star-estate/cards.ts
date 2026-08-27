/**
 * 梨康地产 · 机会 / 命运卡（纯数据 + 洗牌抽牌）。
 *
 * 机会 18 张、命运 18 张，全部原创文案，粉彩萌系、六年级读得懂。
 * 抽完自动洗回，同一副牌在一局里循环使用。
 * 卡片只描述「要发生什么」，真正改状态的是 `economy.ts` 的 `applyCard`。
 */

export type CardEffect =
  /** 直接和银行结算，正数进账、负数出账 */
  | { kind: "cash"; amount: number }
  /** 走到指定格；passGo 为真时经过出发花园照样发钱 */
  | { kind: "moveTo"; pos: number; passGo: boolean }
  /** 往前 / 往后走几格（负数是后退，后退不算经过出发） */
  | { kind: "moveBy"; steps: number }
  /** 直接进小黑屋，不算经过出发 */
  | { kind: "goJail" }
  /** 拿一张出门卡 */
  | { kind: "outCard" }
  /** 按房屋数修缮：每栋小屋 perHouse，每座大屋 perHotel */
  | { kind: "repairs"; perHouse: number; perHotel: number }
  /** 向其他每个人各收 amount */
  | { kind: "collectEach"; amount: number }
  /** 给其他每个人各发 amount */
  | { kind: "payEach"; amount: number }
  /** 场上每个人都要向银行付 amount（从当前行动者起逆时针依次结算） */
  | { kind: "allPay"; amount: number }
  /** 前进到最近的车站 */
  | { kind: "nearestStation" };

export interface EstateCard {
  id: string;
  text: string;
  effect: CardEffect;
}

/** 机会转盘：多半是「动起来」的卡 */
export const CHANCE_CARDS: readonly EstateCard[] = [
  { id: "c01", text: "顺风来啦，一路飘回出发花园，领 200 星币。", effect: { kind: "moveTo", pos: 0, passGo: true } },
  { id: "c02", text: "鸭梨约你去看流星，前进到天文台坡·流星坪。", effect: { kind: "moveTo", pos: 34, passGo: true } },
  { id: "c03", text: "月亮广场今晚有灯会，直接前进到满月顶。", effect: { kind: "moveTo", pos: 39, passGo: true } },
  { id: "c04", text: "汽水街新出了气泡水，前进到气泡口尝一口。", effect: { kind: "moveTo", pos: 6, passGo: true } },
  { id: "c05", text: "赶上一班快车，前进到最近的车站。", effect: { kind: "nearestStation" } },
  { id: "c06", text: "风把你往回吹了三格，慢慢走回去吧。", effect: { kind: "moveBy", steps: -3 } },
  { id: "c07", text: "在鸭梨公园捡到一个装着 50 星币的小钱包，交给失物处后得到谢礼。", effect: { kind: "cash", amount: 50 } },
  { id: "c08", text: "康康帮你摆摊卖手工书签，赚到 120 星币。", effect: { kind: "cash", amount: 120 } },
  { id: "c09", text: "小屋屋顶要刷漆：每栋小屋 40 星币，每座大屋 115 星币。", effect: { kind: "repairs", perHouse: 40, perHotel: 115 } },
  { id: "c10", text: "你在反思角门口踩到湿地板，去里面坐一会儿吧。", effect: { kind: "goJail" } },
  { id: "c11", text: "拿到一张出门卡，什么时候想用都行。", effect: { kind: "outCard" } },
  { id: "c12", text: "参加梨康画展拿了第一名，奖金 150 星币。", effect: { kind: "cash", amount: 150 } },
  { id: "c13", text: "帮邻居搬花盆搬到手酸，每个人都送你 20 星币当谢礼。", effect: { kind: "collectEach", amount: 20 } },
  { id: "c14", text: "请大家喝一轮热可可，每人 25 星币。", effect: { kind: "payEach", amount: 25 } },
  { id: "c15", text: "路灯维修基金开始收钱，场上每个人都交 40 星币。", effect: { kind: "allPay", amount: 40 } },
  { id: "c16", text: "顺路多走了两格看风景。", effect: { kind: "moveBy", steps: 2 } },
  { id: "c17", text: "图书馆大街的朗读会请你当嘉宾，前进到朗读廊。", effect: { kind: "moveTo", pos: 29, passGo: true } },
  { id: "c18", text: "星币税亭发现多收了你一点钱，退回 60 星币。", effect: { kind: "cash", amount: 60 } }
];

/** 命运信箱：多半是「进账出账」的卡 */
export const FATE_CARDS: readonly EstateCard[] = [
  { id: "f01", text: "回出发花园盖个章，领 200 星币。", effect: { kind: "moveTo", pos: 0, passGo: true } },
  { id: "f02", text: "今天是你的生日，每个人都送你 10 星币。", effect: { kind: "collectEach", amount: 10 } },
  { id: "f03", text: "天上掉下 50 星币，正好落在你脚边。", effect: { kind: "cash", amount: 50 } },
  { id: "f04", text: "旧绘本卖了个好价钱，进账 100 星币。", effect: { kind: "cash", amount: 100 } },
  { id: "f05", text: "存在棉花巷小银行的利息到账了，收 25 星币。", effect: { kind: "cash", amount: 25 } },
  { id: "f06", text: "学费单来了，交 150 星币。", effect: { kind: "cash", amount: -150 } },
  { id: "f07", text: "喷泉站要换水泵，你出 100 星币。", effect: { kind: "cash", amount: -100 } },
  { id: "f08", text: "房屋年检：每栋小屋 40 星币，每座大屋 115 星币。", effect: { kind: "repairs", perHouse: 40, perHotel: 115 } },
  { id: "f09", text: "你在休息亭睡过头，被请去反思角坐一会儿。", effect: { kind: "goJail" } },
  { id: "f10", text: "收到一张出门卡，收好别弄丢。", effect: { kind: "outCard" } },
  { id: "f11", text: "去鸭梨公园野餐，走到公园歇一歇。", effect: { kind: "moveTo", pos: 20, passGo: true } },
  { id: "f12", text: "彩虹滨捡贝壳大赛拿了名次，奖金 80 星币。", effect: { kind: "cash", amount: 80 } },
  { id: "f13", text: "给全场每个人买一支星糖，每人 20 星币。", effect: { kind: "payEach", amount: 20 } },
  { id: "f14", text: "社区花坛集资，场上每个人都交 30 星币。", effect: { kind: "allPay", amount: 30 } },
  { id: "f15", text: "帮风车坡收麦子，工钱 140 星币。", effect: { kind: "cash", amount: 140 } },
  { id: "f16", text: "图书捐箱轮到你，交 75 星币。", effect: { kind: "cash", amount: -75 } },
  { id: "f17", text: "赶去南站接朋友，前进到最近的车站。", effect: { kind: "nearestStation" } },
  { id: "f18", text: "走神了，往回退两格。", effect: { kind: "moveBy", steps: -2 } }
];

export type DeckName = "chance" | "fate";

export function cardsOf(deck: DeckName): readonly EstateCard[] {
  return deck === "chance" ? CHANCE_CARDS : FATE_CARDS;
}

export interface CardDeck {
  name: DeckName;
  /** 洗好的抽牌顺序（存的是卡片下标） */
  order: number[];
  /** 下一张从哪儿抽 */
  idx: number;
  /** 洗了几次牌（测试用来确认「抽完洗回」） */
  shuffles: number;
}

function shuffleIndices(n: number, rand: () => number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 洗一副新牌 */
export function makeDeck(name: DeckName, rand: () => number): CardDeck {
  return { name, order: shuffleIndices(cardsOf(name).length, rand), idx: 0, shuffles: 1 };
}

/** 抽一张；抽完了就当场洗回去接着抽，永远不会抽空 */
export function drawCard(deck: CardDeck, rand: () => number): EstateCard {
  const list = cardsOf(deck.name);
  if (deck.idx >= deck.order.length) {
    deck.order = shuffleIndices(list.length, rand);
    deck.idx = 0;
    deck.shuffles++;
  }
  const card = list[deck.order[deck.idx]];
  deck.idx++;
  return card;
}

/** 抽一张机会 */
export function drawChance(deck: CardDeck, rand: () => number): EstateCard {
  return drawCard(deck, rand);
}

/** 抽一张命运 */
export function drawFate(deck: CardDeck, rand: () => number): EstateCard {
  return drawCard(deck, rand);
}
